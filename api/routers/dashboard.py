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
        {"name": "En cours", "value": counts["en_cours"], "color": "#3b82f6"},
        {"name": "En attente", "value": counts["en_attente"], "color": "#f59e0b"},
        {"name": "Approuvés", "value": counts["approuve"], "color": "#10b981"},
        {"name": "Refusés", "value": counts["refuse"], "color": "#ef4444"},
        {"name": "Signalés", "value": counts["signale"], "color": "#8b5cf6"},
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

    # Auto-approved = approuvé with confiance_ia >= 90
    auto_approuves = sum(
        1 for d in all_dossiers
        if d.statut == DossierStatus.approuve and d.confiance_ia >= 90
    )

    return {
        "dossiers_en_cours": counts["en_cours"],
        "en_attente_validation": counts["en_attente"],
        "auto_approuves": auto_approuves,
        "signales_ia": counts["signale"],
        "status_distribution": status_distribution,
        "recent_activity": recent_activity,
    }


def _activity_label(d: Dossier) -> str:
    labels = {
        "approuve": f"Dossier approuvé{' par ' + d.instructeur if d.instructeur else ''}",
        "refuse": f"Dossier refusé{' par ' + d.instructeur if d.instructeur else ''}",
        "signale": f"Dossier signalé par l'IA (confiance {d.confiance_ia}%)",
        "en_cours": "Dossier en cours d'instruction",
        "en_attente": "Dossier en attente de complément",
    }
    return labels.get(d.statut.value, "Mise à jour du dossier")


def _activity_icon(d: Dossier) -> str:
    icons = {
        "approuve": "check",
        "refuse": "x",
        "signale": "alert",
        "en_cours": "plus",
        "en_attente": "plus",
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
