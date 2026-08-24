import pymongo
from datetime import datetime

MONGO_URI = "mongodb+srv://yashmittal30062007_db_user:hKHbOnTQYVnFTXKx@cluster0.hwtyuaj.mongodb.net/?appName=Cluster0"

client = pymongo.MongoClient(MONGO_URI)
db = client["road_safety_db"]
potholes_collection = db["potholes"]

def init_db():
    potholes_collection.create_index([("location", pymongo.GEOSPHERE)])
    print("✅ MongoDB Connected & Geospatial Index Ready!")

def get_nearby_hazards(lat: float, lng: float, max_distance_meters=200):
    query = {
        "location": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                "$maxDistance": max_distance_meters
            }
        }
    }
    nearby = []
    for doc in potholes_collection.find(query):
        nearby.append({
            "_id": doc["_id"], # Needed for updating/deleting
            "latitude": doc["location"]["coordinates"][1],
            "longitude": doc["location"]["coordinates"][0],
            "confidence": doc["confidence"]
        })
    return nearby

def save_pothole(lat: float, lng: float, confidence: float, image_path: str):
    """ POINT 5: DUPLICATE POTHOLE CONTROL """
    # Check if a pothole already exists within 15 meters
    nearby = get_nearby_hazards(lat, lng, 15) 
    
    if nearby:
        # Pothole exists! Update its confidence instead of creating a duplicate
        existing = nearby[0]
        new_conf = min(existing["confidence"] + 0.10, 1.0) # Increase confidence by 10%, max 100%
        
        potholes_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"confidence": new_conf, "timestamp": datetime.now()}}
        )
        print(f"🔄 Duplicate Control: Updated existing hazard. New Confidence: {new_conf}")
    else:
        # Completely new pothole
        pothole_data = {
            "location": {"type": "Point", "coordinates": [lng, lat]},
            "confidence": confidence,
            "image_path": image_path,
            "timestamp": datetime.now()
        }
        potholes_collection.insert_one(pothole_data)
        print("🆕 New hazard saved to DB.")

def decay_hazard_confidence(lat: float, lng: float):
    """ POINT 6: HAZARD VERIFICATION / CONFIDENCE UPDATE """
    # If AI says road is clear, check if we expected a pothole here (within 15m)
    nearby = get_nearby_hazards(lat, lng, 15)
    
    for existing in nearby:
        new_conf = existing["confidence"] - 0.15 # Decrease confidence by 15%
        
        if new_conf < 0.20:
            # Confidence too low, assume repaired and delete
            potholes_collection.delete_one({"_id": existing["_id"]})
            print("🗑️ Hazard Verification: Confidence dropped below 20%. Hazard deleted (Repaired!).")
        else:
            # Update with lower confidence
            potholes_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"confidence": new_conf}}
            )
            print(f"📉 Hazard Verification: Road clear. Decreased confidence to {new_conf}")


def get_all_hazards():
    hazards = []
    for doc in potholes_collection.find():
        hazards.append({
            "id": str(doc["_id"]),
            "latitude": doc["location"]["coordinates"][1],
            "longitude": doc["location"]["coordinates"][0],
            "confidence": doc["confidence"],
            "image_path": doc["image_path"],
            "timestamp": doc["timestamp"].isoformat()
        })
    return hazards
