"""Stable adapter between structurally checked pipeline artifacts and the dashboard."""

from .adapter import build_dashboard_data, write_dashboard_data

__all__ = ["build_dashboard_data", "write_dashboard_data"]
