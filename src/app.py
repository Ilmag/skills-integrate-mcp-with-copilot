"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import json
import os
from pathlib import Path
import secrets

from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

SESSION_COOKIE_NAME = "session_token"


def load_users():
    with open(current_dir / "users.json", "r", encoding="utf-8") as file:
        raw_users = json.load(file)

    users_by_email = {}
    for user in raw_users["users"]:
        users_by_email[user["email"]] = user

    return users_by_email


users = load_users()
sessions = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


class LoginRequest(BaseModel):
    email: str
    password: str


class ActivityRegistrationRequest(BaseModel):
    email: str


def serialize_user(user):
    return {
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }


def get_current_user(session_token: str | None):
    if not session_token:
        return None

    user_email = sessions.get(session_token)
    if not user_email:
        return None

    return users.get(user_email)


def require_authenticated_user(session_token: str | None):
    user = get_current_user(session_token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required for this action"
        )

    return user


def require_activity(activity_name: str):
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    return activities[activity_name]


def ensure_user_can_manage_email(user, email: str, action: str):
    if user["role"] in {"admin", "club_leader"}:
        return

    if user["email"] != email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to {action} for other students"
        )


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/auth/me")
def get_authenticated_user(session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)):
    user = get_current_user(session_token)

    if not user:
        return {"authenticated": False, "user": None}

    return {"authenticated": True, "user": serialize_user(user)}


@app.post("/auth/login")
def login(login_request: LoginRequest, response: Response):
    user = users.get(login_request.email)

    if not user or user["password"] != login_request.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    session_token = secrets.token_urlsafe(32)
    sessions[session_token] = user["email"]

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 8
    )

    return {
        "message": "Logged in successfully",
        "user": serialize_user(user)
    }


@app.post("/auth/logout")
def logout(response: Response, session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)):
    if session_token:
        sessions.pop(session_token, None)

    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"message": "Logged out successfully"}


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    signup_request: ActivityRegistrationRequest,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)
):
    """Sign up a student for an activity"""
    current_user = require_authenticated_user(session_token)
    ensure_user_can_manage_email(current_user, signup_request.email, "sign up")

    activity = require_activity(activity_name)

    if signup_request.email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    activity["participants"].append(signup_request.email)
    return {"message": f"Signed up {signup_request.email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)
):
    """Unregister a student from an activity"""
    current_user = require_authenticated_user(session_token)
    ensure_user_can_manage_email(current_user, email, "unregister")

    activity = require_activity(activity_name)

    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
