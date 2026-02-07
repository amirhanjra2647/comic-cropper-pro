from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate
from django.contrib import messages
from django.utils import timezone
from .models import User


def login_view(request):
    """Custom login view"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            next_url = request.GET.get('next', '/')
            return redirect(next_url)
        else:
            messages.error(request, 'Invalid username or password')
    
    return render(request, 'auth/login.html')


def register_view(request):
    """Registration with auto-pro upgrade"""
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        password2 = request.POST.get('password2')
        
        if password != password2:
            messages.error(request, 'Passwords do not match')
            return render(request, 'auth/register.html')
        
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Username already exists')
            return render(request, 'auth/register.html')
        
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email already registered')
            return render(request, 'auth/register.html')
        
        # Create user with pro plan (free for now)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_pro=True,
            upgraded_at=timezone.now()
        )
        
        login(request, user)
        messages.success(request, 'Account created! Pro features unlocked.')
        return redirect('/')
    
    return render(request, 'auth/register.html')
