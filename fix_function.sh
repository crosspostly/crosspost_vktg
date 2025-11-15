#!/bin/bash
# Fix the corrupted formatVkTextForTelegram function

# Extract clean function from line 2520 to first clean return statement (around 2573)
sed -n '2520,2573p' /home/engine/project/server.gs.backup | sed '/^[[:space:]]*$/d' > /tmp/clean_function.txt

# Extract everything before the function (lines 1-2519)
sed -n '1,2519p' /home/engine/project/server.gs.backup > /tmp/before_function.txt

# Extract everything after the corrupted function (find next function after line 2600)
sed -n '2610,$p' /home/engine/project/server.gs.backup | sed '/^function formatVkTextForTelegram/,/^}$/d' > /tmp/after_function.txt

# Combine all parts
cat /tmp/before_function.txt > /home/engine/project/server_fixed.gs
cat /tmp/clean_function.txt >> /home/engine/project/server_fixed.gs
echo "" >> /home/engine/project/server_fixed.gs
cat /tmp/after_function.txt >> /home/engine/project/server_fixed.gs

# Replace the original file
mv /home/engine/project/server_fixed.gs /home/engine/project/server.gs

echo "Function fixed!"