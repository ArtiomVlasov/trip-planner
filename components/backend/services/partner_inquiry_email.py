import os
import re
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from fastapi import HTTPException

from schemas import PartnerInquiryCreate


EMAIL_PATTERN = re.compile(
    r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+"
)


def _get_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def extract_reply_email(contact_details: str) -> str | None:
    match = EMAIL_PATTERN.search(contact_details)
    return match.group(0) if match else None


def build_partner_inquiry_email_text(body: PartnerInquiryCreate) -> str:
    return "\n".join(
        [
            "Новая заявка на партнёрство из AI Trip Planner",
            "",
            f"1. Название компании или бренда: {body.company_name}",
            f"2. Категория бизнеса и формат площадки: {body.business_category}",
            f"3. Город, адрес и зона обслуживания: {body.city_and_address}",
            f"4. Контактное лицо и каналы связи: {body.contact_details}",
            f"5. Ссылки на сайт, соцсети или карточки бизнеса: {body.business_links}",
        ]
    )


def send_partner_inquiry_email(body: PartnerInquiryCreate) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL") or smtp_username
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "AI Trip Planner")
    smtp_use_tls = _get_bool_env("SMTP_USE_TLS", True)
    smtp_use_ssl = _get_bool_env("SMTP_USE_SSL", False)
    recipient_email = os.getenv("PARTNER_INQUIRY_EMAIL", "Chxir@yandex.ru")
    subject = os.getenv(
        "PARTNER_INQUIRY_SUBJECT",
        "Заявка на партнерство в AI Trip Planner",
    )

    if not smtp_host or not smtp_from_email:
        raise HTTPException(status_code=503, detail="Email service is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((smtp_from_name, smtp_from_email))
    message["To"] = recipient_email

    reply_to = extract_reply_email(body.contact_details)
    if reply_to:
        message["Reply-To"] = reply_to

    message.set_content(build_partner_inquiry_email_text(body))

    try:
        if smtp_use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
            return

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            if smtp_use_tls:
                server.starttls()
                server.ehlo()
            if smtp_username and smtp_password:
                server.login(smtp_username, smtp_password)
            server.send_message(message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to send partner inquiry email") from exc
