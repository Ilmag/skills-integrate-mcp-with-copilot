document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const accountPanel = document.getElementById("account-panel");
  const currentUserDetails = document.getElementById("current-user-details");
  const emailInput = document.getElementById("email");
  const signupHelp = document.getElementById("signup-help");

  const state = {
    currentUser: null,
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `${type} message-visible`;
  }

  function clearMessage() {
    messageDiv.textContent = "";
    messageDiv.className = "hidden";
  }

  function canManageOtherStudents() {
    return ["admin", "club_leader"].includes(state.currentUser?.role);
  }

  function canManageEmail(email) {
    if (!state.currentUser) {
      return false;
    }

    return canManageOtherStudents() || state.currentUser.email === email;
  }

  function updateAuthUI() {
    if (state.currentUser) {
      authStatus.textContent = `Signed in as ${state.currentUser.name}`;
      loginForm.classList.add("hidden");
      accountPanel.classList.remove("hidden");
      currentUserDetails.innerHTML = `
        <strong>${state.currentUser.email}</strong><br />
        <span class="role-chip">${state.currentUser.role.replace("_", " ")}</span>
      `;
      signupHelp.textContent = canManageOtherStudents()
        ? "You can register or unregister any student while signed in with an elevated role."
        : "You can only register or unregister your own student account.";
      signupForm.querySelector("button[type='submit']").disabled = false;

      if (canManageOtherStudents()) {
        emailInput.disabled = false;
        emailInput.value = "";
        emailInput.placeholder = "student@mergington.edu";
      } else {
        emailInput.disabled = true;
        emailInput.value = state.currentUser.email;
      }
    } else {
      authStatus.textContent = "No active session. Log in to manage registrations.";
      loginForm.classList.remove("hidden");
      accountPanel.classList.add("hidden");
      signupHelp.textContent = "Log in to register or unregister students. Student accounts can only manage their own enrollment.";
      signupForm.querySelector("button[type='submit']").disabled = true;
      emailInput.disabled = true;
      emailInput.value = "";
      emailInput.placeholder = "your-email@mergington.edu";
    }
  }

  async function refreshCurrentUser() {
    const response = await fetch("/auth/me");
    const result = await response.json();
    state.currentUser = result.authenticated ? result.user : null;
    updateAuthUI();
  }

  function renderParticipants(activityName, participants) {
    if (participants.length === 0) {
      return "<p><em>No participants yet</em></p>";
    }

    return `
      <div class="participants-section">
        <h5>Participants:</h5>
        <ul class="participants-list">
          ${participants
            .map((email) => {
              const actionButton = canManageEmail(email)
                ? `<button class="delete-btn" data-activity="${activityName}" data-email="${email}">Remove</button>`
                : "";

              return `<li><span class="participant-email">${email}</span>${actionButton}</li>`;
            })
            .join("")}
        </ul>
      </div>`;
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        activityCard.innerHTML = `
          <div class="activity-card-header">
            <h4>${name}</h4>
            <span>${spotsLeft} spots left</span>
          </div>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <div class="participants-container">
            ${renderParticipants(name, details.participants)}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (response.ok) {
        state.currentUser = result.user;
        loginForm.reset();
        updateAuthUI();
        fetchActivities();
        showMessage(result.message, "success");
      } else {
        showMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      showMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
      });
      const result = await response.json();

      if (response.ok) {
        state.currentUser = null;
        clearMessage();
        updateAuthUI();
        fetchActivities();
        showMessage(result.message, "info");
      } else {
        showMessage(result.detail || "Logout failed", "error");
      }
    } catch (error) {
      showMessage("Failed to log out. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(`/activities/${encodeURIComponent(activity)}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        if (canManageOtherStudents()) {
          signupForm.reset();
        }
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  async function initializeApp() {
    await refreshCurrentUser();
    await fetchActivities();
  }

  initializeApp();
});
