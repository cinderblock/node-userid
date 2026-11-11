{
    "targets": [
        {
            "target_name": "userid",
            "sources": ["userid.cc"],
            # Enables C++ exceptions everywhere (cflags, Xcode, MSVC) the way node-addon-api expects
            "dependencies": ["<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except"],
            # The oldest Node-API version that has everything we use. One binary then loads on every Node.js version.
            #
            # NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS: when a worker thread is terminated with lookups in flight, its
            # promises can't be settled and errors can't be thrown any more. Without this, node-addon-api turns that
            # into an uncaught C++ exception, which aborts the whole process.
            "defines": ["NAPI_VERSION=8", "NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS"],
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
