from .models import Tool


def tools_context(request):
    """Add active tools to all templates"""
    return {
        'available_tools': Tool.objects.filter(is_active=True),
        'user_is_pro': request.user.is_authenticated and request.user.is_pro,
    }
