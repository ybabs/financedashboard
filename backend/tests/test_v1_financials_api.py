import pytest

import api.routers.v1_financials as v1_financials_router


@pytest.mark.anyio
async def test_v1_financial_metrics_catalog(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def list_metric_definitions(self):
            class Def:
                def __init__(self, metric_key, tags):
                    self.metric_key = metric_key
                    self.tags = tags

            return [
                Def("assets", ["assets", "netassetsliabilities"]),
                Def("net_profit", ["profitloss"]),
            ]

    monkeypatch.setattr(v1_financials_router, "FinancialsRepository", FakeRepo)
    res = await client.get("/v1/financials/metrics", headers=make_auth_headers())
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 2
    assert body["items"][0]["metric_key"] == "assets"
    assert "assets" in body["items"][0]["tags"]
