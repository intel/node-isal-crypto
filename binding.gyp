{
  'target_defaults': {
    'conditions': [
      [
        "'<!(node -p process.env.npm_config_coverage)'=='true'",
        {
          'cflags': ['--coverage'],
          'libraries': ['--coverage']
        }
      ]
    ]
  },
  'targets': [
    {
      'target_name': 'isal_crypto',
      'include_dirs': [
        '<(module_root_dir)/isa-l_crypto/include'
      ],
      'dependencies': [
        'isa-l_crypto.gyp:isa-l_crypto'
      ],
      'cflags': [
        '-Wall'
      ],
      'sources': [
        'src/bind_mb_hash.h',
        'src/common.h',
        'src/main.cc',
      ]
    }
  ]
}
