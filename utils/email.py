import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = "noreply@resumetric.com"  # Needs to be a verified sender in SendGrid

def send_email(to_email: str, subject: str, html_content: str):
    if not SENDGRID_API_KEY:
        print(f"[Mock Email] To: {to_email} | Subject: {subject}")
        return False
        
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        html_content=html_content)
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_login_reminder(to_email: str, username: str):
    subject = "Don't lose your streak on Resumetric!"
    content = f"<h3>Hi {username},</h3><p>You haven't logged in today. Keep your daily streak alive and earn reputation points by logging into Resumetric now!</p>"
    send_email(to_email, subject, content)

def send_new_follower_alert(to_email: str, username: str, follower_name: str):
    subject = f"New Follower: {follower_name} started following you!"
    content = f"<h3>Hi {username},</h3><p>Great news! <strong>{follower_name}</strong> has started following you on Resumetric. Build your community to increase your rank!</p>"
    send_email(to_email, subject, content)
