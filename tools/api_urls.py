from django.urls import path
from . import api_views

urlpatterns = [
    path('detect/', api_views.detect_panels, name='api_detect'),
    path('batch-crop/', api_views.batch_crop, name='api_batch_crop'),
    path('excel/save/', api_views.save_excel, name='api_excel_save'),
    path('excel/export/', api_views.export_excel, name='api_excel_export'),
]
