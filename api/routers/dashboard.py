from fastapi import APIRouter
from api.models.dossier import Dossier, DossierStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats():
    all_dossiers = await Dossier.find_all().to_list()

    counts: dict[str, int] = {s.value: 0 for s in DossierStatus}
    for d in all_dossiers:
        counts[d.statut.value] += 1

    status_distribution = [
        {"name": "Boîte de réception", "value": counts["boite_reception"], "color": "#8b5cf6"},
        {"name": "En instruction", "value": counts["en_instruction"], "color": "#3b82f6"},
        {"name": "En attente", "value": counts["en_attente"], "color": "#f59e0b"},
        {"name": "Approuvés", "value": counts["approuve"], "color": "#10b981"},
        {"name": "Refusés", "value": counts["refuse"], "color": "#ef4444"},
    ]

    recent = sorted(all_dossiers, key=lambda d: d.derniere_maj, reverse=True)[:5]
    recent_activity = [
        {
            "id": str(d.id),
            "dossier": d.reference,
            "action": _activity_label(d),
            "time": _relative_time(d.derniere_maj),
            "icon": _activity_icon(d),
        }
        for d in recent
    ]

    return {
        "boite_reception": counts["boite_reception"],
        "dossiers_en_instruction": counts["en_instruction"],
        "en_attente_validation": counts["en_attente"],
        "auto_approuves": counts["approuve"],
        "status_distribution": status_distribution,
        "recent_activity": recent_activity,
    }


def _activity_label(d: Dossier) -> str:
    labels = {
        "boite_reception": "Dossier reçu",
        "en_instruction": "Dossier en cours d'instruction",
        "en_attente": "Dossier en attente de complément",
        "approuve": f"Dossier approuvé{' par ' + d.instructeur if d.instructeur else ''}",
        "refuse": f"Dossier refusé{' par ' + d.instructeur if d.instructeur else ''}",
    }
    return labels.get(d.statut.value, "Mise à jour du dossier")


def _activity_icon(d: Dossier) -> str:
    icons = {
        "boite_reception": "inbox",
        "en_instruction": "plus",
        "en_attente": "plus",
        "approuve": "check",
        "refuse": "x",
    }
    return icons.get(d.statut.value, "plus")


def _relative_time(dt) -> str:
    from datetime import datetime, timezone
    now = datetime.utcnow()
    diff = now - dt.replace(tzinfo=None) if hasattr(dt, 'tzinfo') and dt.tzinfo else now - dt
    seconds = int(diff.total_seconds())
    if seconds < 3600:
        minutes = max(1, seconds // 60)
        return f"Il y a {minutes} min"
    if seconds < 86400:
        hours = seconds // 3600
        return f"Il y a {hours}h"
    days = seconds // 86400
    return f"Il y a {days} jour(s)"
