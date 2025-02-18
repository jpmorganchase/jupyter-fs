import os
import unittest.mock

import pytest
from fs.opener.parse import parse_fs_url

from jupyterfs.auth import substituteAsk, substituteEnv

# we use `prefix_username` as `username` is often present in os.environ

urls = [
    "foo://bar",
    "foo://username@bar",
    "foo://username:pword@bar",
    "foo://{{prefix_username}}:pword@bar",
    "foo://{{prefix_username}}:{{pword}}@bar",
]

token_dicts = [
    {},
    {"prefix_username": "username"},
    {"pword": "pword"},
    {"prefix_username": "username", "pword": "pword"},
    {"prefix_username": "user:na@me", "pword": "pwo@r:d"},
]


def _url_tokens_pair():
    for url in urls:
        for token_dict in token_dicts:
            yield url, token_dict


@pytest.fixture(params=_url_tokens_pair())
def any_url_token_ask_resource(request):
    url, token_dict = request.param
    return dict(url=url, tokenDict=token_dict)


@pytest.fixture(params=_url_tokens_pair())
def any_url_token_env_resource(request):
    url, token_dict = request.param
    with unittest.mock.patch.dict(os.environ, token_dict):
        yield dict(url=url)


def test_ensure_ask_validates(any_url_token_ask_resource):
    url, missing = substituteAsk(any_url_token_ask_resource)
    if missing:
        return pytest.xfail(f"tokens are not sufficient, missing: {missing}")
    # simply ensure it doesn't throw:
    parse_fs_url(url)


def test_ensure_env_validates(any_url_token_env_resource):
    url, missing = substituteEnv(any_url_token_env_resource)
    if missing:
        return pytest.xfail(f"tokens are not sufficient, missing: {missing}")
    # simply ensure it doesn't throw:
    parse_fs_url(url)
