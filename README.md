# Node.js bindings for [isa-l_crypto](https://github.com/01org/isa-l_crypto)

Time-testing command:
```sh
for ((Nix = 0; Nix < 10; Nix++)); do \
  ( time node test/stream.js  ) 2>&1 \
    | grep -E '^(real|user|sys)' \
    | sed -e 's/0m//' -e 's/s$//' \
    | awk '{printf $0 "\t";} END {print("");}'; \
done
```
