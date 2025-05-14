//Script
// Initialize Supabase client with project URL and anon key.
const supabaseClient = supabase.createClient(
    'https://vzubmycafgnjtwnjfpop.supabase.co',  // Supabase URL
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo' // Supabase API Key
);

// Store manual overrides for room statuses.
let manualOverrides = {};
let currentRoom = null;

// Function to handle changes in the manual override dropdown.
function manualOverrideChanged() {
    const value = document.getElementById("overrideStatus").value;  // Get the selected override value.
    if (currentRoom) {
        manualOverrides[currentRoom] = value;  // Set the manual override for the current room.
        updateRoomStatus(currentRoom);  // Refresh the view after the change.
    }
}

// Function to update room status based on data from Supabase.
async function updateRoomStatus(room, event) {
  currentRoom = room;

  // Define DOM elements to update with room details.
  const roomStatusElement = document.getElementById("room-status");
  const roomNoElement = document.getElementById("room-no");
  const roomTypeElement = document.getElementById("room-type-details");
  const roomScheduleElement = document.getElementById("room-schedule");
  const occupiedByElement = document.getElementById("occupied-by");
  const instructorElement = document.getElementById("instructor");
  const scanIndicator = document.getElementById("scan-indicator");
  const scanLabel = document.getElementById("scan-label");

  resetScanIndicator();  // Reset the scan indicator state.

  // Highlight the clicked button.
  document.querySelectorAll("button").forEach(btn => {
      btn.classList.remove("bg-orange-100");  // Remove highlight from all buttons.
  });
  if (event) event.target.classList.add("bg-orange-100");  // Highlight the clicked button.

  roomStatusElement.textContent = 'LOADING...';  // Display loading state.
  roomStatusElement.style.color = 'gray';  // Set loading text color.

  // Fetch the schedule for the room from Supabase.
  const { data, error } = await supabaseClient
      .from('schedules_test')  // Use the 'schedules_test' table
      .select('*')
      .eq('room', room)  // Filter by room
      .order('start_time', { ascending: true });  // Sort by start time

  if (error) {
      console.error('Error fetching schedule:', error);
      roomStatusElement.textContent = 'Error loading schedule';  // Display error message if data fetch fails.
      roomStatusElement.style.color = 'red';  // Change text color to red for error.
      return;
  }

  // Update the schedule section of the UI with the fetched data.
  const scheduleContainer = document.getElementById("schedule-container");
  if (data.length === 0) {
      scheduleContainer.innerHTML = '<tr><td colspan="5" class="px-4 py-2 text-center text-gray-500">No schedule found for this room.</td></tr>';
  } else {
      scheduleContainer.innerHTML = data.map(schedule => {
          const startTime = new Date(schedule.start_time).toLocaleString([], {hour: '2-digit', minute:'2-digit', hour12: true});
          const endTime = new Date(schedule.end_time).toLocaleString([], {hour: '2-digit', minute:'2-digit', hour12: true});
          const timeRange = `${startTime} - ${endTime}`;  // Combine start and end time.
          const date = new Date(schedule.date).toLocaleDateString(); // Format the date.
          
          return `
              <tr>
                <td class="px-4 py-2 border">${schedule.section}</td>
                <td class="px-4 py-2 border">${schedule.subject}</td>
                <td class="px-4 py-2 border">${schedule.prof}</td>
                <td class="px-4 py-2 border">${date}</td>
                <td class="px-4 py-2 border">${timeRange}</td>
              </tr>
          `;
      }).join('');
  }

    // Handle room status update based on schedule or manual override.
    const now = new Date();
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

    let currentSchedule = null;
    for (const schedule of data || []) {
        if (!schedule || !schedule.start_time || !schedule.end_time) continue;

        const start = new Date(schedule.start_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const end = new Date(schedule.end_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' });

        const startTime = new Date(start);
        const endTime = new Date(end);

        const nowMs = localDate.getTime();
        if (startTime.getTime() <= nowMs && nowMs <= endTime.getTime()) {
            currentSchedule = schedule;
            break;
        }
    }

    const override = manualOverrides[room] || 'auto';

    // Update the room display based on manual override or schedule data.
    if (override === 'leave') {
        updateRoomDisplay('AVAILABLE 📘', 'green', room, null);
    } else if (override === 'enter') {
        updateRoomDisplay('OCCUPIED', 'red', room, null);
    } else if (currentSchedule) {
        updateRoomDisplay('OCCUPIED', 'red', room, currentSchedule);
    } else {
        updateRoomDisplay('AVAILABLE', 'green', room, null);
    }

    // Function to update room display based on status and schedule data.
    function updateRoomDisplay(status, color, room, schedule = null) {
        roomStatusElement.textContent = status;
        roomStatusElement.style.color = color;
        roomNoElement.textContent = `ROOM ${room}`;
        roomTypeElement.textContent = schedule?.subject || 'N/A';
        roomScheduleElement.textContent = schedule
            ? `${formatTimeTo12Hour(schedule.start_time)} - ${formatTimeTo12Hour(schedule.end_time)}, ${new Date(schedule.date).toLocaleDateString()}`
            : 'N/A';
        occupiedByElement.textContent = schedule?.section || 'N/A';
        instructorElement.textContent = schedule?.prof || 'N/A';
    }

    // Reset the scan indicator to a neutral state.
    function resetScanIndicator() {
        scanIndicator.className = 'w-3 h-3 rounded-full bg-gray-400 inline-block';
        scanLabel.textContent = 'No scan';
    }
}

// Format time to 12-hour AM/PM format.
function formatTimeTo12Hour(timeString) {
    const date = new Date(timeString);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'AM' : 'PM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${minutes} ${ampm}`;
}

// Update the status of all room buttons based on the current schedule.
async function updateAllRoomButtons() {
    const roomNumbers = ['300', '310', '311', '312', '313', '314', '315', '316'];

    const now = new Date();
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

    // Fetch all schedule data.
    const { data, error } = await supabaseClient
        .from('schedules_test')
        .select('*');

    if (error) {
        console.error('Failed to fetch schedule data:', error);
        return;
    }

    // Iterate through each room number and update its button's color based on its current schedule.
    roomNumbers.forEach(room => {
        const button = document.querySelector(`button[onclick*="'${room}'"]`);
        if (!button) return;

        const roomSchedules = data.filter(s => s.room === room);
        const hasCurrentSchedule = roomSchedules.some(schedule => {
            const start = new Date(new Date(schedule.start_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            const end = new Date(new Date(schedule.end_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            return start <= localNow && localNow <= end;
        });

        // Change the button color based on whether the room is occupied or not.
        if (hasCurrentSchedule) {
            button.classList.remove('bg-green-500');
            button.classList.add('bg-red-500');
        } else {
            button.classList.remove('bg-red-500');
            button.classList.add('bg-green-500');
        }
    });
}

// Update room buttons when the document is ready and every 60 seconds.
document.addEventListener("DOMContentLoaded", updateAllRoomButtons);
setInterval(updateAllRoomButtons, 60000); // Refresh every 60 seconds

//SENSORS
      document.addEventListener("DOMContentLoaded", async () => {
        const SUPABASE_URL = 'https://vzubmycafgnjtwnjfpop.supabase.co';
        const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo';
  
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_API_KEY);
  
        async function fetchLatestSensorData() {
          const { data, error } = await client
            .from('comp_data')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
  
          if (error) {
            console.error('Error fetching latest data:', error);
            return;
          }
  
          if (data.length > 0) {
            const latest = data[0];
            document.getElementById('temperature').textContent = `Temperature: ${latest.temperature?.toFixed(1)} °C`;
            document.getElementById('humidity').textContent = `Humidity: ${latest.humidity?.toFixed(1)} %`;
            document.getElementById('light').textContent = `Light: ${latest.light}`;
            document.getElementById('timestamp').textContent = `Timestamp: ${new Date(latest.created_at).toLocaleString()}`;
  
            const lightStatus = latest.light > 100 ? 'On' : 'Off';
            const lightStatusElement = document.getElementById('light-status');
            lightStatusElement.textContent = `Light Status: ${lightStatus}`;
            lightStatusElement.className = `text-2xl font-semibold ${lightStatus === 'On' ? 'text-green-600' : 'text-red-600'}`;
  
            const motionStatus = latest.motion === 1 ? 'Motion Detected' : 'No Motion';
            const motionStatusElement = document.getElementById('motion-status');
            motionStatusElement.textContent = `Motion Status: ${motionStatus}`;
            motionStatusElement.className = `text-2xl font-semibold ${motionStatus === 'Motion Detected' ? 'text-green-600' : 'text-gray-500'}`;
          }
        }
  
        fetchLatestSensorData();
      });
//LOGS
const SUPABASE_URL = 'https://vzubmycafgnjtwnjfpop.supabase.co';
const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo';
const TABLE_NAME = 'schedules_test';
let allSchedules = [];

async function loadAllSchedules() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=*`, {
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`
      }
    });

    if (!response.ok) throw new Error(await response.text());

    allSchedules = await response.json(); // Store for filtering

    populateFilters();
    renderSchedule(allSchedules);

  } catch (err) {
    console.error("Error loading schedules:", err.message);
    document.getElementById("schedule-table").innerHTML = `<p class="text-red-600">Failed to load schedules.</p>`;
  }
}

function populateFilters() {
const roomSet = new Set();
const profSet = new Set();
const sectionSet = new Set();

allSchedules.forEach(s => {
if (s.room) roomSet.add(s.room);
if (s.prof) profSet.add(s.prof);
if (s.section) sectionSet.add(s.section);
});

const roomSelect = document.getElementById("filter-room");
const profSelect = document.getElementById("filter-professor");
const sectionSelect = document.getElementById("filter-section");

roomSet.forEach(room => roomSelect.innerHTML += `<option value="${room}">${room}</option>`);
profSet.forEach(prof => profSelect.innerHTML += `<option value="${prof}">${prof}</option>`);
sectionSet.forEach(section => sectionSelect.innerHTML += `<option value="${section}">${section}</option>`);

[roomSelect, profSelect, sectionSelect].forEach(select => {
select.addEventListener("change", applyFilters);
});
}

function applyFilters() {
const selectedRoom = document.getElementById("filter-room").value;
const selectedProf = document.getElementById("filter-professor").value;
const selectedSection = document.getElementById("filter-section").value;

const filtered = allSchedules.filter(s => {
return (!selectedRoom || s.room === selectedRoom) &&
       (!selectedProf || s.prof === selectedProf) &&
       (!selectedSection || s.section === selectedSection);
});

renderSchedule(filtered);
}

function formatTimeRange(start, end) {
const options = { hour: '2-digit', minute: '2-digit' };
const startFormatted = new Date(start).toLocaleTimeString([], options);
const endFormatted = new Date(end).toLocaleTimeString([], options);
return `${startFormatted} - ${endFormatted}`;
}

function renderSchedule(schedules) {
if (schedules.length === 0) {
document.getElementById("schedule-table").innerHTML = "<p class='text-gray-500 p-4'>No schedules match the selected filters.</p>";
return;
}

let html = `
<table class="min-w-full text-sm text-left border-collapse">
  <thead class="bg-orange-500 text-white">
    <tr>
      <th class="px-4 py-2 border">Room</th>
      <th class="px-4 py-2 border">Instructor</th>
      <th class="px-4 py-2 border">Subject</th>
      <th class="px-4 py-2 border">Section</th>
      <th class="px-4 py-2 border">Date</th>
      <th class="px-4 py-2 border">Time</th>
      <th class="px-4 py-2 border">Semester</th>
    </tr>
  </thead>
  <tbody>
`;

schedules.forEach(s => {
html += `
  <tr class="border-t">
    <td class="px-4 py-2 border">${s.room || '-'}</td>
    <td class="px-4 py-2 border">${s.prof || '-'}</td>
    <td class="px-4 py-2 border">${s.subject || '-'}</td>
    <td class="px-4 py-2 border">${s.section || '-'}</td>
    <td class="px-4 py-2 border">${s.date || '-'}</td>
    <td class="px-4 py-2 border">${formatTimeRange(s.start_time, s.end_time)}</td>
    <td class="px-4 py-2 border">${s.semester || '-'}</td>
  </tr>
`;
});

html += `</tbody></table>`;
document.getElementById("schedule-table").innerHTML = html;
}


loadAllSchedules();
//ROOMS


function manualOverrideChanged() {
    const value = document.getElementById("overrideStatus").value;
    if (currentRoom) {
        manualOverrides[currentRoom] = value;
        updateRoomStatus(currentRoom); // Refresh view after override change
    }
}

async function updateRoomStatus(room, event) {
    currentRoom = room;

    const roomStatusElement = document.getElementById("room-status");
    const roomNoElement = document.getElementById("room-no");
    const roomTypeElement = document.getElementById("room-type-details");
    const roomScheduleElement = document.getElementById("room-schedule");
    const occupiedByElement = document.getElementById("occupied-by");
    const instructorElement = document.getElementById("instructor");
    const scanIndicator = document.getElementById("scan-indicator");
    const scanLabel = document.getElementById("scan-label");

    resetScanIndicator();

    document.querySelectorAll("button").forEach(btn => {
        btn.classList.remove("bg-orange-100");
    });
    if (event) event.target.classList.add("bg-orange-100");

    roomStatusElement.textContent = 'LOADING...';
    roomStatusElement.style.color = 'gray';

    // Set dropdown to current override
    document.getElementById("overrideStatus").value = manualOverrides[room] || 'auto';

    const { data, error } = await supabaseClient
        .from('schedules_test')
        .select('*')
        .eq('room', room);

    if (error) {
        console.error('Error fetching room data:', error);
        roomStatusElement.textContent = 'Error loading schedule';
        roomStatusElement.style.color = 'red';
        return;
    }

    const now = new Date();
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

    let currentSchedule = null;

    for (const schedule of data || []) {
        if (!schedule || !schedule.start_time || !schedule.end_time) continue;

        const start = new Date(schedule.start_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const end = new Date(schedule.end_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' });

        const startTime = new Date(start);
        const endTime = new Date(end);

        const nowMs = localDate.getTime();
        if (startTime.getTime() <= nowMs && nowMs <= endTime.getTime()) {
            currentSchedule = schedule;
            break;
        }
    }

    const override = manualOverrides[room] || 'auto';

    if (override === 'leave') {
        updateRoomDisplay('AVAILABLE 📘', 'green', room, null);
    } else if (override === 'enter') {
        updateRoomDisplay('OCCUPIED', 'red', room, null);
    } else if (currentSchedule) {
        updateRoomDisplay('OCCUPIED', 'red', room, currentSchedule);
        if (room === '315') {
            await checkFingerprintScan(currentSchedule);
        }
    } else {
        updateRoomDisplay('AVAILABLE', 'green', room, null);
    }

    function updateRoomDisplay(status, color, room, schedule = null) {
        roomStatusElement.textContent = status;
        roomStatusElement.style.color = color;
        roomNoElement.textContent = `ROOM ${room}`;
        roomTypeElement.textContent = schedule?.subject || 'N/A';
        roomScheduleElement.textContent = schedule
            ? `${formatTimeTo12Hour(schedule.start_time)} - ${formatTimeTo12Hour(schedule.end_time)}, ${new Date(schedule.date).toLocaleDateString()}`
            : 'N/A';
        occupiedByElement.textContent = schedule?.section || 'N/A';
        instructorElement.textContent = schedule?.prof || 'N/A';
    }

    function resetScanIndicator() {
        scanIndicator.className = 'w-3 h-3 rounded-full bg-gray-400 inline-block';
        scanLabel.textContent = 'No scan';
    }

    async function checkFingerprintScan(schedule) {
        try {
            const { data: scans, error } = await supabaseClient
                .from('fingerprint_logsv')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10);

            if (error || !scans) return;

            const nowMs = new Date().getTime();
            const recentScans = scans.filter(scan => {
                const scanTime = new Date(scan.timestamp).getTime();
                return nowMs - scanTime < 30 * 60 * 1000;
            });

            const scanNames = recentScans.map(s => s.name.toLowerCase());
            const profName = schedule.prof.toLowerCase();

            if (scanNames.includes(profName)) {
                scanIndicator.className = 'w-3 h-3 rounded-full bg-green-500 inline-block';
                scanLabel.textContent = 'Professor scanned in';
            } else if (recentScans.length > 0) {
                scanIndicator.className = 'w-3 h-3 rounded-full bg-red-500 inline-block';
                scanLabel.textContent = 'Other person(s) scanned';
            } else {
                resetScanIndicator();
            }
        } catch (err) {
            console.error('Error checking fingerprint scan:', err);
        }
    }
}

// Format time into 12-hour format with AM/PM
function formatTimeTo12Hour(timeString) {
    const date = new Date(timeString);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'AM' : 'PM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${minutes} ${ampm}`;
}
//Schedules
    // Dropdown menu code
    let dropdown = document.getElementById("dropdownMenu");

    function toggleDropdown() {
        dropdown.classList.toggle("hidden");
    
        if (!dropdown.classList.contains("hidden")) {
            dropdown.classList.remove("opacity-0", "scale-95");
            dropdown.classList.add("opacity-100", "scale-100");
        } else {
            dropdown.classList.remove("opacity-100", "scale-100");
            dropdown.classList.add("opacity-0", "scale-95");
        }
    }
    

    document.addEventListener("click", function (event) {
        let button = document.querySelector("button[onclick='toggleDropdown()']");
        if (!dropdown.contains(event.target) && !button.contains(event.target)) {
            dropdown.classList.add("hidden");
        }
    });

    function openModal(mode = 'Add') {
        document.getElementById("modal").classList.remove("hidden");

        if (mode === 'Add') {
            currentSchedule = null;
            document.getElementById("scheduleForm").reset(); // Only reset on Add
        }
    }

    function closeModal() {
        document.getElementById("modal").classList.add("hidden");
        currentSchedule = null;
        document.getElementById("scheduleForm").reset();
    }

    let currentSchedule = null;

    // Format time into 12-hour format with AM/PM
    function formatTimeTo12Hour(timeString) {
        const date = new Date(timeString);
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'pm' : 'am';

        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;

        return `${hours}:${minutes} ${ampm}`;
    }

    // Update schedule and display it in the table
    async function updateSchedule(room) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?room=eq.${room}&select=*`, {
                headers: {
                    'apikey': SUPABASE_API_KEY,
                    'Authorization': `Bearer ${SUPABASE_API_KEY}`
                }
            });

            if (!response.ok) throw new Error(await response.text());

            let scheduleData = await response.json();

            let table = `<table class='w-full border-collapse border border-gray-400 mt-4'>
                <thead>
                    <tr class='bg-orange-500 text-white'>
                        <th class='border border-gray-400 px-4 py-2'>Section</th>
                        <th class='border border-gray-400 px-4 py-2'>Subject</th>
                        <th class='border border-gray-400 px-4 py-2'>Instructor</th>
                        <th class='border border-gray-400 px-4 py-2'>Date</th>
                        <th class='border border-gray-400 px-4 py-2'>Academic Year</th>
                        <th class='border border-gray-400 px-4 py-2'>Semester</th>
                        <th class='border border-gray-400 px-4 py-2'>Time</th>
                        <th class='border border-gray-400 px-4 py-2'>Actions</th>
                    </tr>
                </thead>
                <tbody>`;

            if (scheduleData.length > 0) {
                scheduleData.forEach((s) => {
                    // Format start and end times
                    const startTimeFormatted = formatTimeTo12Hour(s.start_time);
                    const endTimeFormatted = formatTimeTo12Hour(s.end_time);

                    table += `<tr>
                        <td class='border border-gray-400 px-4 py-2'>${s.section}</td>
                        <td class='border border-gray-400 px-4 py-2'>${s.subject}</td>
                        <td class='border border-gray-400 px-4 py-2'>${s.prof}</td>
                        <td class='border border-gray-400 px-4 py-2'>${s.date}</td>
                        <td class='border border-gray-400 px-4 py-2'>${s.academicYear}</td>
                        <td class='border border-gray-400 px-4 py-2'>${s.semester}</td>
                        <td class='border border-gray-400 px-4 py-2'>${startTimeFormatted} - ${endTimeFormatted}</td>
                        <td class='border border-gray-400 px-4 py-2'>
                            <button onclick='editSchedule(${JSON.stringify(s)})' class='text-blue-600 underline mr-2'>Edit</button>
                            <button onclick='deleteSchedule(${s.id}, "${room}")' class='text-red-600 underline'>Delete</button>
                        </td>
                    </tr>`;
                });
            } else {
                table += `<tr>
                    <td colspan='8' class='border border-gray-400 px-4 py-2 text-center text-red-500'>No schedule available</td>
                </tr>`;
            }

            table += `</tbody></table>`;
            document.getElementById("room-schedule").innerHTML =
                `<h2 class="text-center text-xl font-bold text-orange-600 mb-4">Room ${room}</h2>` + table;

        } catch (err) {
            console.error("Error fetching schedule:", err.message);
            alert("Error loading schedule: " + err.message);
        }
    }

    // Edit schedule details
// Edit schedule details
function editSchedule(schedule) {
    currentSchedule = schedule; // Store the schedule to edit
    document.getElementById("room").value = schedule.room;
    document.getElementById("date").value = schedule.date;
    document.getElementById("academicYear").value = schedule.academicYear || "";
    document.getElementById("semester").value = schedule.semester || "";
    document.getElementById("startTime").value = schedule.start_time ? new Date(schedule.start_time).toLocaleTimeString() : "";
    document.getElementById("endTime").value = schedule.end_time ? new Date(schedule.end_time).toLocaleTimeString() : "";
    document.getElementById("section").value = schedule.section;
    document.getElementById("subject").value = schedule.subject;
    document.getElementById("prof").value = schedule.prof;
    openModal('Edit'); // Open modal in Edit mode
}

// Save schedule (both for add and edit)
// Save schedule (both for add and edit)
async function saveSchedule(event) {
    event?.preventDefault?.();
    
    // Get values from the form
    let room = document.getElementById("room").value.trim();
    let date = document.getElementById("date").value.trim(); // Accept date as-is (string)
    let academicYear = document.getElementById("academicYear").value.trim();
    let semester = document.getElementById("semester").value.trim();
    let startTime = document.getElementById("startTime").value.trim();
    let endTime = document.getElementById("endTime").value.trim();

    // Convert times to ISO string format with time zone information
    const startDateTime = new Date(`${date}T${startTime}`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}`).toISOString();

    // Combine Year Level and Section
    let yearLevel = document.getElementById("yearLevel").value.trim();
    let section = document.getElementById("section").value.trim();
    let combinedSection = `${yearLevel}-${section}`;


    let subject = document.getElementById("subject").value.trim();
    let prof = document.getElementById("prof").value.trim();

    // Validation check
    if (!room || !date || !academicYear || !startTime || !endTime || !semester || !combinedSection || !subject || !prof) {
        alert("Please fill in all fields before saving.");
        return;
    }

    const submitButton = document.getElementById("submitButton");
    if (submitButton) submitButton.disabled = true;

    try {
        const isEditing = currentSchedule !== null; // Check if we're editing
        const method = isEditing ? 'PATCH' : 'POST'; // Use PATCH for editing, POST for creating
        const url = isEditing
            ? `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${currentSchedule.id}` // Update existing schedule
            : `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`; // Create new schedule

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_API_KEY,
                'Authorization': `Bearer ${SUPABASE_API_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                room, date, academicYear, start_time: startDateTime, end_time: endDateTime,
                section: combinedSection, subject, prof, semester
            })
        });

        if (!response.ok) throw new Error(await response.text());

        alert(isEditing ? "Schedule updated!" : "Schedule saved!");
        closeModal();
        currentSchedule = null; // Reset currentSchedule after saving or updating
        updateSchedule(room); // Refresh the schedule for that room

    } catch (err) {
        console.error("Save error:", err.message);
        alert("Failed: " + err.message);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}


    // Delete schedule
    async function deleteSchedule(id, room) {
        const confirmed = confirm("Are you sure you want to delete this schedule?");
        if (!confirmed) return;

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_API_KEY,
                    'Authorization': `Bearer ${SUPABASE_API_KEY}`,
                    'Prefer': 'return=representation'
                }
            });

            if (!response.ok) throw new Error(await response.text());

            alert("Schedule deleted.");
            updateSchedule(room);
        } catch (err) {
            console.error("Delete error:", err.message);
            alert("Delete error: " + err.message);
        }
    }