#!/bin/bash
cd ~/Desktop/project/wyc-backend
node -e 'const db=require("./src/config/database");const l=db.prepare("SELECT name,phone,postcode,service_type,status,created_at FROM leads ORDER BY created_at DESC").all();console.log("Total leads:",l.length);console.table(l);'
