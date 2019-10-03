{
  'variables': {
    'nasm_path': "<!(node -p 'require(\"which\").sync(\"nasm\");')",
    'conditions': [
      [ 'OS=="win"', {
        'object_suffix': 'obj',
        'as': 'yasm',

        # No AVX512 or NI support on Windows with yasm 1.3.0
        'avx512_files': [],
        'avx512_defines': [],
      }, {
        'object_suffix': 'o',
        'as': 'nasm',
        'avx512_files': [
          'isa-l_crypto/sha256_mb/sha256_ctx_avx512.c',
          'isa-l_crypto/sha256_mb/sha256_ctx_avx512_ni.c',
          'isa-l_crypto/sha256_mb/sha256_mb_mgr_init_avx512.c',
          'isa-l_crypto/sha512_mb/sha512_ctx_avx512.c',
          'isa-l_crypto/sha512_mb/sha512_mb_mgr_init_avx512.c',

          # Assembly source files

          ## SHA256
          'isa-l_crypto/sha256_mb/sha256_mb_mgr_flush_avx512.asm',
          'isa-l_crypto/sha256_mb/sha256_mb_mgr_flush_avx512_ni.asm',
          'isa-l_crypto/sha256_mb/sha256_mb_mgr_submit_avx512.asm',
          'isa-l_crypto/sha256_mb/sha256_mb_x16_avx512.asm',
          'isa-l_crypto/sha256_mb/sha256_ni_x1.asm',
          'isa-l_crypto/sha256_mb/sha256_ni_x2.asm',

          ## SHA512
          'isa-l_crypto/sha512_mb/sha512_mb_mgr_flush_avx512.asm',
          'isa-l_crypto/sha512_mb/sha512_mb_mgr_submit_avx512.asm',
          'isa-l_crypto/sha512_mb/sha512_mb_x8_avx512.asm',

          # ... and their assembled counterparts

          ## SHA256
          '<(INTERMEDIATE_DIR)/sha256_mb_mgr_submit_avx512.o',
          '<(INTERMEDIATE_DIR)/sha256_mb_mgr_flush_avx512.o',
          '<(INTERMEDIATE_DIR)/sha256_mb_x16_avx512.o',
          '<(INTERMEDIATE_DIR)/sha256_mb_mgr_flush_avx512_ni.o',
          '<(INTERMEDIATE_DIR)/sha256_ni_x1.o',
          '<(INTERMEDIATE_DIR)/sha256_ni_x2.o',

          ## SHA512
          '<(INTERMEDIATE_DIR)/sha512_mb_mgr_flush_avx512.o',
          '<(INTERMEDIATE_DIR)/sha512_mb_mgr_submit_avx512.o',
          '<(INTERMEDIATE_DIR)/sha512_mb_x8_avx512.o',
        ],
        'avx512_defines': [
          '-DHAVE_AS_KNOWS_AVX512=1',
          '-DHAVE_AS_KNOWS_SHANI=1',
        ]
      } ],
      [ 'target_arch=="x64"',
        {
          'conditions': [
            [ 'OS=="win"', {'asm_arch': 'win64'}, {'asm_arch': 'elf64'} ]
          ]
        },
        {
          'conditions': [
            [ 'OS=="win"', {'asm_arch': 'win32'}, {'asm_arch': 'elf32'} ]
          ]
        },
      ]
    ]
  },
  'targets': [
    {
      'target_name': 'isa-l_crypto',
      'type': 'static_library',
      'sources': [
        ## SHA256
        'isa-l_crypto/sha256_mb/sha256_ctx_avx2.c',
        'isa-l_crypto/sha256_mb/sha256_ctx_avx.c',
        'isa-l_crypto/sha256_mb/sha256_ctx_base.c',
        'isa-l_crypto/sha256_mb/sha256_ctx_sse.c',
        'isa-l_crypto/sha256_mb/sha256_ctx_sse_ni.c',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_init_avx2.c',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_init_sse.c',

        #SHA512
        'isa-l_crypto/sha512_mb/sha512_ctx_avx2.c',
        'isa-l_crypto/sha512_mb/sha512_ctx_avx.c',
        'isa-l_crypto/sha512_mb/sha512_ctx_base.c',
        'isa-l_crypto/sha512_mb/sha512_ctx_sse.c',
        'isa-l_crypto/sha512_mb/sha512_ctx_sb_sse4.c',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_init_avx2.c',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_init_sse.c',
        'isa-l_crypto/sha512_mb/sha512_sb_mgr_flush_sse4.c',
        'isa-l_crypto/sha512_mb/sha512_sb_mgr_init_sse4.c',
        'isa-l_crypto/sha512_mb/sha512_sb_mgr_submit_sse4.c',

        # Assembly source files

        ## SHA256
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_flush_avx2.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_flush_avx.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_flush_sse.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_flush_sse_ni.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_submit_avx2.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_submit_avx.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_submit_sse.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_mgr_submit_sse_ni.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_x4_avx.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_x4_sse.asm',
        'isa-l_crypto/sha256_mb/sha256_mb_x8_avx2.asm',
        'isa-l_crypto/sha256_mb/sha256_multibinary.asm',
        'isa-l_crypto/sha256_mb/sha256_opt_x1.asm',

        ##SHA512
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_flush_avx2.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_flush_avx.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_flush_sse.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_submit_avx2.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_submit_avx.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_mgr_submit_sse.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_x2_avx.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_x2_sse.asm',
        'isa-l_crypto/sha512_mb/sha512_mb_x4_avx2.asm',
        'isa-l_crypto/sha512_mb/sha512_multibinary.asm',
        'isa-l_crypto/sha512_mb/sha512_sse4.asm',

        # ... and their assembled counterparts

        ## SHA256
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_submit_sse.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_submit_avx.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_submit_avx2.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_flush_sse.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_flush_avx.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_flush_avx2.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_x4_sse.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_x4_avx.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_x8_avx2.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_multibinary.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_opt_x1.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_submit_sse_ni.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha256_mb_mgr_flush_sse_ni.<(object_suffix)',

        ## SHA512
        '<(INTERMEDIATE_DIR)/sha512_mb_mgr_flush_avx2.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_mgr_flush_avx.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_mgr_flush_sse.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_mgr_submit_avx2.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_mgr_submit_avx.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_mgr_submit_sse.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_x2_avx.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_x2_sse.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_mb_x4_avx2.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_multibinary.<(object_suffix)',
        '<(INTERMEDIATE_DIR)/sha512_sse4.<(object_suffix)',

        '<@(avx512_files)'
      ],
      'include_dirs': [
        '<(module_root_dir)/isa-l_crypto/include/',
        '<(module_root_dir)/isa-l_crypto/sha256_mb/',
        '<(module_root_dir)/isa-l_crypto/sha512_mb/',
      ],
      'conditions': [
        ['OS!="win"', {
          'defines': [
            'HAVE_AS_KNOWS_AVX512=1',
            'HAVE_AS_KNOWS_SHANI=1'
          ],
        } ]
      ],
      'rules': [
        {
          'rule_name': 'nasm',
          'extension': 'asm',
          'inputs': [ '<(nasm_path)' ],
          'outputs': [ '<(INTERMEDIATE_DIR)/<(RULE_INPUT_ROOT).<(object_suffix)' ],
          'message': 'Assemble <(RULE_INPUT_PATH)',
          'action': [
            '<(as)',
            '-f<(asm_arch)',
            '-I', '<(module_root_dir)/isa-l_crypto/include/',
            '-I', '<(module_root_dir)/isa-l_crypto/sha256_mb/',
            '-I', '<(module_root_dir)/isa-l_crypto/sha512_mb/',
            '-DPIC',
            '<@(avx512_defines)',
            '-o', '<(INTERMEDIATE_DIR)/<(RULE_INPUT_ROOT).<(object_suffix)',
            '<(RULE_INPUT_PATH)',
          ]
        },
      ]
    },
  ]
}
