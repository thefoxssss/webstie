#!/bin/bash
npm i -g http-server
http-server -p 8080 > server_output.log 2>&1 &
