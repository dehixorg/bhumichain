import httpx
import asyncio

async def main():
    payload = {
        "dlpiId":              "DLPI-UP-DAD-740201",
        "surveyNumber":        "740/201",
        "khasraNo":            "740/201",
        "tehsil":              "Dadri",
        "tehsilCode":          "DAD",
        "district":            "Gautam Buddha Nagar",
        "state":               "Uttar Pradesh",
        "landType":            "Jirayat",
        "landTypeDescription": "Bhumidhari",
        "areaHectares":        2.4,
        "isTribal":            False,
        "scheduleVArea":       False,
        "initialOwners": [
            {
                "name":         "Arun Sharma",
                "aadhaarHash":  "sha256:ea4b4befa6136e0d37e28328bd54425bf7e04cc996e387063cc17fc148bd94e1",
                "share":        "1/1",
                "shareDecimal": 1.0
            }
        ],
        "ownershipType":       "SOLE",
        "latitude":            28.5355,
        "longitude":           77.3910,
        "boundaryPolygon":     None,
        "circleRateINR":       5000000,
        "ipfsCID":             "QmDemo",
        "sourceType":          "RECORD_SCAN_AI"
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post("http://localhost:4000/api/auth/demo-token", json={"persona": "tehsildar"})
        if not resp.is_success:
            print("Failed to get token", resp.text)
            return
        token = resp.json()["token"]
        
        # Post to gateway
        res = await client.post("http://localhost:4000/api/dlpi", json=payload, headers={"Authorization": f"Bearer {token}"})
        print(res.status_code, res.text)

asyncio.run(main())
