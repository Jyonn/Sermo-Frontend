for i in $(seq -w 1 80); do
  seed="sermo-$i"
  curl -sL "https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}" \
    -o "src/assets/avatars/${i}.svg"
done