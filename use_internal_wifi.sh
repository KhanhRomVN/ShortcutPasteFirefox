#!/bin/bash

INTERNAL_IF="wlp0s20f3"
USB_IF="wlx00e036503ae8"

echo ">> Ngắt USB WiFi ($USB_IF)..."
nmcli device disconnect $USB_IF

echo ">> Kích hoạt lại profile WiFi gần nhất bằng WiFi tích hợp ($INTERNAL_IF)..."
nmcli device connect $INTERNAL_IF

echo ">> Trạng thái thiết bị:"
nmcli device status
