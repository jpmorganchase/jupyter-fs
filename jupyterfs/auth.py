# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import os
from string import Template
import urllib.parse

__all__ = [
    "DoubleBraceTemplate",
    "substituteAsk",
    "substituteEnv",
    "substituteNone",
]


class _BaseTemplate(Template):
    def tokens(self):
        return [m[0] for m in self.pattern.findall(self.template)]


class DoubleBraceTemplate(_BaseTemplate):
    """Template subclass that will replace any '{{VAR}}'"""

    delimiter = ""
    pattern = r"""
    (?:
      {{(?P<braced>\S+?)}}    | # match anything in double braces
      (?P<escaped>a^)        | # match nothing
      (?P<named>a^)          | # match nothing
      (?P<invalid>a^)          # match nothing
    )
    """


if not hasattr(DoubleBraceTemplate, "get_identifiers"):
    # back-fill of 3.11 method. Th function body is copied from CPython under the
    # Python Software Foundation License Version 2. And is subject to the below copy right:
    # Copyright (c) 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
    # 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023 Python Software Foundation;
    # All Rights Reserved

    def get_identifiers(self):
        ids = []
        for mo in self.pattern.finditer(self.template):
            named = mo.group("named") or mo.group("braced")
            if named is not None and named not in ids:
                # add a named group only the first time it appears
                ids.append(named)
            elif named is None and mo.group("invalid") is None and mo.group("escaped") is None:
                # If all the groups are None, there must be
                # another group we're not expecting
                raise ValueError("Unrecognized named group in pattern", self.pattern)
        return ids

    setattr(DoubleBraceTemplate, "get_identifiers", get_identifiers)


def stdin_prompt(url):
    from getpass import getpass

    template = DoubleBraceTemplate(url)
    subs = {}
    for ident in template.get_identifiers():
        subs[ident] = urllib.parse.quote(getpass(f"Enter value for {ident!r}: "))
    return template.safe_substitute(subs)


def substituteAsk(resource):
    if "tokenDict" in resource:
        url = DoubleBraceTemplate(resource["url"]).safe_substitute({k: urllib.parse.quote(v) for k, v in resource.pop("tokenDict").items()})
    else:
        url = resource["url"]

    # return the substituted string and the names of any missing vars
    return url, DoubleBraceTemplate(url).tokens()


def substituteEnv(resource):
    url = DoubleBraceTemplate(resource["url"]).safe_substitute(os.environ)

    # return the substituted string and the names of any missing vars
    return url, DoubleBraceTemplate(url).tokens()


def substituteNone(resource):
    url = resource["url"]

    return url, DoubleBraceTemplate(url).tokens()
