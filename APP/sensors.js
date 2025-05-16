//Sensors
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
      }); //Successfully fecthed data
      //Update