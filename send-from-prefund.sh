#!/bin/bash
FROM_ADDR="0x45c3c0c9c2c4416b23966fd4e3acec8e84a0f434"
TO_ADDR="0x987d3241ae658af82822e3c227cd3433e982b976"
AMOUNT="100"

echo "Sending $AMOUNT BTCD from $FROM_ADDR to $TO_ADDR..."

docker exec -i chocochoco-geth1-1 geth attach /data/geth.ipc << GETHCMD
personal.unlockAccount("$FROM_ADDR", "", 300)
eth.sendTransaction({from: "$FROM_ADDR", to: "$TO_ADDR", value: web3.toWei($AMOUNT, "ether"), gas: 21000})
GETHCMD
