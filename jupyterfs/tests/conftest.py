import pytest
import sys

# ref: http://doc.pytest.org/en/latest/example/markers.html#marking-platform-specific-tests-with-pytest

PLATFORM_INFO = {'darwin': 'mac', 'linux': 'linux', 'win32': 'windows'}
PLATFORMS = set(PLATFORM_INFO.keys())

def pytest_configure(config):
    # register the platform markers
    for info in PLATFORM_INFO.items():
        config.addinivalue_line(
            "markers", "{}: mark test to run only on platform == {}".format(*info)
        )

def pytest_runtest_setup(item):
    platforms_for_test = PLATFORMS.intersection(mark.name for mark in item.iter_markers())

    if platforms_for_test and sys.platform not in platforms_for_test:
        pytest.skip('cannot run on platform %s' % sys.platform)
