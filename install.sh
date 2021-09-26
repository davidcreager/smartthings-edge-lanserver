#!/usr/bin/env bash
groupadd smartdev
adduser smartdev --system --no-create-home
usermod -a -G smartdev,dialout smartdev

mkdir /var/opt/node/smartthings-edge-lanserver/
cp -r * /var/opt/node/smartthings-edge-lanserver/
chgrp -R smartdev /var/opt/node/smartthings-edge-lanserver/

cp node-ble.conf /etc/dbus-1/system.d/
cp baseServer.service /etc/systemd/system/


systemctl daemon-reload
systemctl enable baseServer.service



