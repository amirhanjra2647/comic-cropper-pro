from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.core.files.base import ContentFile
from django.utils import timezone
import json
import zipfile
from io import BytesIO
from .processors.cropper import process_image, crop_image
from .processors.excel_processor import excel_to_json, json_to_excel, json_to_pdf
from .models import CropJob, ExcelDocument


@csrf_exempt
@require_POST
def detect_panels(request):
    """API endpoint for panel detection"""
    try:
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return JsonResponse({'error': 'No file provided'}, status=400)
        
        image_bytes = uploaded_file.read()
        panels = process_image(image_bytes)
        
        return JsonResponse({'panels': panels})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_POST
@login_required
def batch_crop(request):
    """Batch crop multiple images (Pro only)"""
    if not request.user.is_pro:
        return JsonResponse({'error': 'Pro plan required'}, status=403)
    
    try:
        files = request.FILES.getlist('files')
        if not files:
            return JsonResponse({'error': 'No files provided'}, status=400)
        
        # Create crop job
        crop_job = CropJob.objects.create(
            user=request.user,
            image_count=len(files),
            status='processing'
        )
        
        # Process images and create ZIP
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for idx, uploaded_file in enumerate(files, 1):
                image_bytes = uploaded_file.read()
                panels = process_image(image_bytes)
                
                # Crop each panel
                for panel_idx, panel in enumerate(panels, 1):
                    cropped_bytes = crop_image(image_bytes, panel)
                    filename = f"{uploaded_file.name.split('.')[0]}_panel_{panel_idx}.png"
                    zip_file.writestr(filename, cropped_bytes)
        
        # Save ZIP to crop job
        zip_buffer.seek(0)
        crop_job.result_zip.save(
            f'batch_crop_{crop_job.id}.zip',
            ContentFile(zip_buffer.getvalue())
        )
        crop_job.status = 'completed'
        crop_job.completed_at = timezone.now()
        crop_job.save()
        
        return JsonResponse({
            'success': True,
            'job_id': crop_job.id,
            'download_url': crop_job.result_zip.url
        })
        
    except Exception as e:
        if 'crop_job' in locals():
            crop_job.status = 'failed'
            crop_job.save()
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def save_excel(request):
    """Save Excel data"""
    try:
        data = json.loads(request.body)
        spreadsheet_data = data.get('data', [])
        title = data.get('title', 'Untitled')
        
        # Convert to Excel
        excel_bytes = json_to_excel(spreadsheet_data)
        
        # Save to database if user is authenticated
        if request.user.is_authenticated:
            doc = ExcelDocument.objects.create(
                user=request.user,
                title=title,
                data=spreadsheet_data
            )
            doc.file.save(f'{title}.xlsx', ContentFile(excel_bytes))
            return JsonResponse({'success': True, 'doc_id': doc.id})
        
        # Return file for download if anonymous
        from django.http import HttpResponse
        response = HttpResponse(
            excel_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{title}.xlsx"'
        return response
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def export_excel(request):
    """Export Excel as XLSX or PDF"""
    try:
        data = json.loads(request.body)
        spreadsheet_data = data.get('data', [])
        format_type = data.get('format', 'xlsx')  # xlsx or pdf
        title = data.get('title', 'export')
        
        if format_type == 'pdf':
            file_bytes = json_to_pdf(spreadsheet_data, title)
            content_type = 'application/pdf'
            extension = 'pdf'
        else:
            file_bytes = json_to_excel(spreadsheet_data)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            extension = 'xlsx'
        
        from django.http import HttpResponse
        response = HttpResponse(file_bytes, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{title}.{extension}"'
        return response
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
