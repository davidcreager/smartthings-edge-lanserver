#!/usr/bin/env bash

if [ $(getent group smartdev) ]; then
  echo "smartdev group exists."
else
  echo "smartdev group does not exist - Creating"
  groupadd smartdev
fi


if id smartdev &>/dev/null; then
	echo "smartdev user exists"
else
	echo "smartdev user does not exist - Creating"
	adduser smartdev --system --no-create-home
	usermod -a -G smartdev,dialout smartdev
fi

if [ -d "/var/opt/node" ];  then
	echo "/var/opt/node directory exists"
else
	echo "/var/opt/node does not exist - creating"
	mkdir /var/opt/node/
fi

if [ -d "/var/opt/node/smartthings-edge-lanserver/" ]; then
	echo "/var/opt/node/smartthings-edge-lanserver/ directory exists - Clearing"
	rm -r /var/opt/node/smartthings-edge-lanserver/
else
	echo "/var/opt/node/smartthings-edge-lanserver/ does not exist - Creating"
	#mkdir /var/opt/node/smartthings-edge-lanserver/
fi
mkdir /var/opt/node/smartthings-edge-lanserver/
cp -r * /var/opt/node/smartthings-edge-lanserver/
chgrp -R smartdev /var/opt/node/smartthings-edge-lanserver/
chown smartdev /var/opt/node/smartthings-edge-lanserver/*.json
chmod a+x *.js

cp node-ble.conf /etc/dbus-1/system.d/
cp serverManager.service /etc/systemd/system/

systemctl daemon-reload
##systemctl enable serverManager.service



