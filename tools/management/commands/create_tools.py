"""
Management command to create initial tools
"""
from django.core.management.base import BaseCommand
from tools.models import Tool


class Command(BaseCommand):
    help = 'Create initial tools in database'

    def handle(self, *args, **kwargs):
        tools_data = [
            {
                'name': 'Image Cropper',
                'slug': 'crop',
                'icon': '✂️',
                'description': 'Crop and split images with auto-detection',
                'template_name': 'cropper.html',
                'requires_pro': False,
                'order': 1
            },
            {
                'name': 'Excel Editor',
                'slug': 'excel',
                'icon': '📊',
                'description': 'Edit spreadsheets and export to Excel/PDF',
                'template_name': 'excel.html',
                'requires_pro': False,
                'order': 2
            },
        ]
        
        for tool_data in tools_data:
            tool, created = Tool.objects.get_or_create(
                slug=tool_data['slug'],
                defaults=tool_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created tool: {tool.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Tool already exists: {tool.name}'))
