import json
from pathlib import PurePosixPath


class ContentsClient:
    def __init__(self, jp_fetch):
        self.fetch = jp_fetch

    async def set_resources(self, resources):
        rep = await self.fetch(
            "/jupyterfs/resources",
            method="POST",
            body=json.dumps(
                {
                    "options": {},
                    "resources": resources,
                }
            ),
        )
        return json.loads(rep.body)

    async def mkdir(self, path, parents=False):
        if parents:
            pp = PurePosixPath(path)
            for i, _ in enumerate(pp.parts):
                await self.mkdir("/".join(pp.parts[:i]))
            return
        rep = await self.fetch(
            f"/api/contents/{path.strip('/')}",
            method="PUT",
            body=json.dumps({"type": "directory"}),
        )
        return json.loads(rep.body)

    async def save(self, path, model):
        rep = await self.fetch(
            f"/api/contents/{path}",
            method="PUT",
            body=json.dumps(model),
        )
        return json.loads(rep.body)

    async def get(self, path):
        rep = await self.fetch(f"/api/contents/{path}", raise_error=True)
        return json.loads(rep.body)
