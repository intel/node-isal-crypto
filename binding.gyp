{
  'targets': [
    {
      'target_name': 'csdk',
      'type': 'none',
      'actions': [
        {
          'action_name': 'build',
          'inputs': [
            'isa-l_crypto/Makefile.unx'
          ],
          'outputs': [
            'isa-l_crypto/bin/isa-l_crypto.a'
          ],
          'action': [
            'make',
            '-C',
            'isa-l_crypto',
            '-f',
            'Makefile.unx'
          ]
        }
      ]
    },
    {
      'target_name': 'isal_crypto',
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'dependencies': [
        'csdk',
        "<!@(node -p \"require('node-addon-api').gyp\")"
      ],
      'defines': [
        'NAPI_DISABLE_CPP_EXCEPTIONS'
      ],
      'sources': [
        'src/main.cc'
      ]
    }
  ]
}
