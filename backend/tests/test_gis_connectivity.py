from __future__ import annotations

import networkx as nx

from backend.app.services.isolation_service import IsolationService
from backend.app.services.road_exposure_service import RoadExposureService
from backend.app.services.routing_service import RoutingService


def test_road_exposure_does_not_claim_closure():
    roads = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "r1",
                "geometry": {"type": "LineString", "coordinates": [[92.70, 23.70], [92.72, 23.72]]},
                "properties": {"road_id": "r1", "name": "Fixture Road", "source": "test_fixture"},
            }
        ],
    }
    risk = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[92.705, 23.705], [92.73, 23.705], [92.73, 23.73], [92.705, 23.73], [92.705, 23.705]]],
                },
                "properties": {"risk_score": 80, "source": "test_fixture"},
            }
        ],
    }
    result = RoadExposureService().analyze(roads, risk)
    road = result["features"][0]["properties"]
    assert road["status"] == "high_risk"
    assert road["closure_confirmed"] is False
    assert road["exposed_length_m"] > 0


def test_safer_route_uses_risk_penalty():
    graph = nx.Graph()
    graph.add_edge("A", "B", travel_time_s=10, length_m=100, risk_score=90)
    graph.add_edge("B", "D", travel_time_s=10, length_m=100, risk_score=90)
    graph.add_edge("A", "C", travel_time_s=15, length_m=120, risk_score=5)
    graph.add_edge("C", "D", travel_time_s=15, length_m=120, risk_score=5)
    result = RoutingService(graph=graph).compare("A", "D")
    assert result["fastest_route"]["nodes"] == ["A", "B", "D"]
    assert result["safer_route"]["nodes"] == ["A", "C", "D"]
    assert result["unverified_reports_close_edges"] is False


def test_isolation_scenario_is_labeled():
    graph = nx.Graph()
    graph.add_edges_from([("v", "x"), ("x", "hospital")])
    results = IsolationService().analyze(
        graph,
        [{"village_id": "v1", "village_name": "Fixture Village", "nearest_node": "v"}],
        ["hospital"],
        [("x", "hospital")],
        analysis_mode="risk_scenario",
    )
    assert results[0]["isolation_status"] == "potentially_isolated"
    assert results[0]["analysis_mode"] == "risk_scenario"

