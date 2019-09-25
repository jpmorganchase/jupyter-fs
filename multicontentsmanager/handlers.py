import json
from notebook.base.handlers import IPythonHandler


class GetHandler(IPythonHandler):
    def initialize(self, keys=None):
        # dont append colon for default
        self.keys = keys or []

    def get(self):
        self.finish(json.dumps(self.keys))
