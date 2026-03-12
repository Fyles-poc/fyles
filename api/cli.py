"""
CLI de gestion des utilisateurs Fyles.

Usage depuis la racine du projet :
    python -m api.cli create-user
    python -m api.cli list-users
    python -m api.cli reset-password <email>
    python -m api.cli delete-user <email>
"""

import asyncio
import sys

import click
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from api.config import get_settings
from api.models.user import User, UserRole
from api.models.workflow import Workflow
from api.models.dossier import Dossier
from api.models.organization import Organization
from api.auth import hash_password


async def _init_db():
    cfg = get_settings()
    client = AsyncIOMotorClient(cfg.mongodb_url)
    await init_beanie(
        database=client[cfg.mongodb_db],
        document_models=[Dossier, Workflow, User, Organization],
    )
    return client


@click.group()
def cli():
    """Gestion des utilisateurs Fyles."""
    pass


@cli.command("create-user")
@click.option("--email", prompt="Email")
@click.option("--password", prompt="Mot de passe", hide_input=True, confirmation_prompt="Confirmer le mot de passe")
@click.option("--nom", prompt="Nom")
@click.option("--prenom", prompt="Prénom")
@click.option(
    "--role",
    default="instructeur",
    type=click.Choice(["admin", "instructeur", "superviseur"]),
    prompt="Rôle",
    show_default=True,
)
def create_user(email: str, password: str, nom: str, prenom: str, role: str):
    """Crée un nouvel utilisateur."""

    async def _run():
        client = await _init_db()
        try:
            existing = await User.find_one(User.email == email)
            if existing:
                click.echo(f"Erreur : l'email {email} est déjà utilisé.", err=True)
                sys.exit(1)
            user = User(
                nom=nom,
                prenom=prenom,
                email=email,
                role=UserRole(role),
                actif=True,
                hashed_password=hash_password(password),
            )
            await user.insert()
            click.echo(f"✓ Utilisateur {prenom} {nom} <{email}> créé avec le rôle '{role}'.")
        finally:
            client.close()

    asyncio.run(_run())


@cli.command("list-users")
def list_users():
    """Liste tous les utilisateurs."""

    async def _run():
        client = await _init_db()
        try:
            users = await User.find_all().to_list()
            if not users:
                click.echo("Aucun utilisateur en base.")
                return
            click.echo(f"{'Email':<35} {'Nom':<25} {'Rôle':<15} {'Statut':<10} {'Pwd'}")
            click.echo("-" * 95)
            for u in users:
                status = "actif" if u.actif else "inactif"
                has_pwd = "✓" if u.hashed_password else "✗ (pas de mot de passe)"
                click.echo(f"{u.email:<35} {u.prenom + ' ' + u.nom:<25} {u.role:<15} {status:<10} {has_pwd}")
        finally:
            client.close()

    asyncio.run(_run())


@cli.command("reset-password")
@click.argument("email")
@click.option("--password", prompt="Nouveau mot de passe", hide_input=True, confirmation_prompt="Confirmer")
def reset_password(email: str, password: str):
    """Réinitialise le mot de passe d'un utilisateur."""

    async def _run():
        client = await _init_db()
        try:
            user = await User.find_one(User.email == email)
            if not user:
                click.echo(f"Erreur : aucun utilisateur avec l'email {email}.", err=True)
                sys.exit(1)
            user.hashed_password = hash_password(password)
            await user.save()
            click.echo(f"✓ Mot de passe de {email} réinitialisé.")
        finally:
            client.close()

    asyncio.run(_run())


@cli.command("delete-user")
@click.argument("email")
@click.confirmation_option(prompt="Êtes-vous sûr de vouloir supprimer cet utilisateur ?")
def delete_user(email: str):
    """Supprime un utilisateur."""

    async def _run():
        client = await _init_db()
        try:
            user = await User.find_one(User.email == email)
            if not user:
                click.echo(f"Erreur : aucun utilisateur avec l'email {email}.", err=True)
                sys.exit(1)
            await user.delete()
            click.echo(f"✓ Utilisateur {email} supprimé.")
        finally:
            client.close()

    asyncio.run(_run())


if __name__ == "__main__":
    cli()
