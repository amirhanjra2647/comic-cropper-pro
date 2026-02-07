from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import Http404
from .models import Tool


def home(request):
    """Redirect to first active tool or show tool list"""
    first_tool = Tool.objects.filter(is_active=True).first()
    if first_tool:
        return redirect('tool', tool_slug=first_tool.slug)
    return render(request, 'home.html')


def tool_view(request, tool_slug):
    """Dynamic tool renderer"""
    tool = get_object_or_404(Tool, slug=tool_slug, is_active=True)
    
    # Check pro requirement
    if tool.requires_pro and not (request.user.is_authenticated and request.user.is_pro):
        return render(request, 'upgrade_required.html', {'tool': tool})
    
    # Render tool template
    template_name = f'tools/{tool.template_name}'
    return render(request, template_name, {'tool': tool})
