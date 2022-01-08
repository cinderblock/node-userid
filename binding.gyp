{
    "targets": [
        {
            "target_name": "userid",
            "sources": ["src/sources.cc"],
            "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
            "cflags_cc": ["-std=c++17"],
            "link_settings": {
                "libraries+": ["-lgcov"],
            },
            "xcode_settings": {
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "CLANG_CXX_LIBRARY": "libc++",
                "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            },
            "msvs_settings": {
                "VCCLCompilerTool": {"ExceptionHandling": 1},
            },
            "conditions": [
                [
                    'OS=="mac"',
                    {
                        # TODO: Is this needed?
                        "cflags+": ["-fvisibility=hidden"],
                        "xcode_settings": {
                            "GCC_SYMBOLS_PRIVATE_EXTERN": "YES",  # -fvisibility=hidden
                        },
                    },
                ],
            ],
            "configurations": {
                "Debug": {
                    "cflags+": ["--coverage"],
                    "cflags_cc+": ["--coverage"],
                },
            },
        },
    ],
}
