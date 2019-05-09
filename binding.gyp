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
            'node',
            'build-scripts/build-isa-l.js'
          ]
        }
      ]
    },
    {
      'target_name': 'isal_crypto',
      'include_dirs': [
        '<(module_root_dir)/isa-l_crypto/include'
      ],
      'libraries': [
        '<(module_root_dir)/isa-l_crypto/bin/isa-l_crypto.a'
      ],
      'dependencies': [
        'csdk'
      ],
      'cflags': [
        '-Wall'
      ],
      'sources': [
        'src/bind_mb_hash.h',
        'src/bind_mh_sha256.c',
        'src/bind_md5_mb.cc',
        'src/bind_sha1_mb.cc',
        'src/bind_sha256_mb.cc',
        'src/bind_sha512_mb.cc',
        'src/common.h',
        'src/main.c',
      ]
    }
  ]
}
