from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Tool, CropJob, ExcelDocument


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom user admin with pro plan management"""
    list_display = ['username', 'email', 'is_pro', 'is_staff', 'date_joined']
    list_filter = ['is_pro', 'is_staff', 'is_superuser']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Pro Plan', {'fields': ('is_pro', 'upgraded_at')}),
    )
    actions = ['make_pro', 'remove_pro']
    
    def make_pro(self, request, queryset):
        from django.utils import timezone
        queryset.update(is_pro=True, upgraded_at=timezone.now())
        self.message_user(request, f"{queryset.count()} users upgraded to Pro")
    make_pro.short_description = "Upgrade selected users to Pro"
    
    def remove_pro(self, request, queryset):
        queryset.update(is_pro=False)
        self.message_user(request, f"{queryset.count()} users downgraded from Pro")
    remove_pro.short_description = "Remove Pro from selected users"


@admin.register(Tool)
class ToolAdmin(admin.ModelAdmin):
    """Admin for managing tools dynamically"""
    list_display = ['icon', 'name', 'slug', 'requires_pro', 'is_active', 'order']
    list_editable = ['is_active', 'order', 'requires_pro']
    list_filter = ['is_active', 'requires_pro']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'slug', 'icon', 'description')
        }),
        ('Configuration', {
            'fields': ('template_name', 'requires_pro', 'is_active', 'order')
        }),
    )


@admin.register(CropJob)
class CropJobAdmin(admin.ModelAdmin):
    """Admin for monitoring crop jobs"""
    list_display = ['id', 'user', 'status', 'image_count', 'created_at', 'completed_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'completed_at']
    date_hierarchy = 'created_at'


@admin.register(ExcelDocument)
class ExcelDocumentAdmin(admin.ModelAdmin):
    """Admin for Excel documents"""
    list_display = ['title', 'user', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['title', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
