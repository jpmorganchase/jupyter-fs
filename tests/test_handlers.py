# for Coverage
import tornado.web
from mock import MagicMock
from multicontentsmanager.handlers import GetHandler


class TestExtension:
    def test_get_handler(self):
        app = tornado.web.Application()
        m = MagicMock()
        h = GetHandler(app, m)
        h._transforms = []
        h.get()
