# NATTEN build compatibility

Source: official PyPI natten 0.17.1 source distribution.
SHA256: a2142722faa41fa3ae6d22e91ed527b2a6da5c4fe09a006f36d68edccaf9c643
The source archive includes its original MIT license.

scripts/setup_allin1.py applies build-only changes after verifying the archive:
- Use Python sysconfig.get_path('include') instead of removed distutils API.
- Select a Release build.
- Specify CMake policy compatibility 3.5 for the older dependency build scripts.

The attention implementation and official All-In-One weights are unchanged.
