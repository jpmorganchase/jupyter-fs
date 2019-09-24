import json
from notebook.base.handlers import IPythonHandler


class GetHandler(IPythonHandler):
    def initialize(self, keys=None):
        self.keys = keys or []

    def get(self):
        self.finish(json.dumps(self.keys))
