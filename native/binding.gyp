{
    "targets": [
        {
            "target_name": "userid",
            "sources": ["userid.cc"],
            # Enables C++ exceptions everywhere (cflags, Xcode, MSVC) the way node-addon-api expects
            "dependencies": ["<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except"],
            # The oldest Node-API version that has everything we use. One binary then loads on every Node.js version.
            "defines": ["NAPI_VERSION=8"],
            "cflags_cc": ["-std=c++17"],
            "xcode_settings": {
                "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
                "MACOSX_DEPLOYMENT_TARGET": "11.0",
            },
            # libstdc++ stays dynamically linked: Node.js itself already needs a newer one than we do.
            # Linking it statically made the binaries 5x bigger and pulled in newer glibc symbols.
            # scripts/check-prebuilds.sh enforces the symbol versions the Linux binaries may need.
        },
    ],
}
