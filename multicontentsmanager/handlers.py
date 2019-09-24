from notebook.base.handlers import IPythonHandler


class GetHandler(IPythonHandler):
    def initialize(self):
        pass

    def get(self):
        self.finish({})
        return
