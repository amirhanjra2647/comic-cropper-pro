from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.text import slugify


class User(AbstractUser):
    """Extended user model with pro plan support"""
    is_pro = models.BooleanField(default=True)  # Free for now
    upgraded_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return self.username


class Tool(models.Model):
    """Dynamic tool configuration"""
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    icon = models.CharField(max_length=50, default='🔧')
    description = models.TextField()
    template_name = models.CharField(max_length=100, help_text="Template file name (e.g., 'cropper.html')")
    requires_pro = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order', 'name']
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name


class CropJob(models.Model):
    """Track batch crop jobs"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='crop_jobs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    image_count = models.IntegerField(default=0)
    result_zip = models.FileField(upload_to='crop_results/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"CropJob #{self.id} - {self.user.username} - {self.status}"


class ExcelDocument(models.Model):
    """Store Excel documents for editing"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='excel_docs', null=True, blank=True)
    title = models.CharField(max_length=200, default='Untitled')
    file = models.FileField(upload_to='excel_docs/')
    data = models.JSONField(null=True, blank=True, help_text="Cached spreadsheet data")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.title} - {self.user.username if self.user else 'Anonymous'}"
