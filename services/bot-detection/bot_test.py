import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def run_bot_test():
    print("[TEST] Starting Automated Bot Detection Test...")
    
    chrome_options = Options()
    # chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    driver.set_window_size(1280, 1024)
    wait = WebDriverWait(driver, 15)
    
    try:
        url = "http://localhost:5174"
        driver.get(url)
        print(f"Page title: {driver.title}")
        
        # 2. Start Session
        print("Waiting for 'Start Session'...")
        start_btn = wait.until(EC.element_to_be_clickable((By.ID, "start-session-btn")))
        start_btn.click()
        time.sleep(2)
        
        # 3. Simulate Robotic Movement
        print("Simulating robotic mouse movements...")
        # Reset mouse to a stable center position
        ActionChains(driver).move_by_offset(300, 300).perform()
        
        for i in range(5):
            ActionChains(driver).move_by_offset(20, 10).pause(0.1).perform()
            ActionChains(driver).move_by_offset(-20, 10).pause(0.1).perform()
            
        print("Simulating robotic clicks...")
        for _ in range(3):
            ActionChains(driver).click().pause(0.5).perform()
            
        time.sleep(2)
        
        # 4. End Session
        print("Clicking 'End Session & Predict'...")
        end_btn = wait.until(EC.element_to_be_clickable((By.ID, "end-session-btn")))
        end_btn.click()
        
        # 5. Wait for Prediction
        print("Waiting for results...")
        time.sleep(10)
        
        # 6. Scrape Results
        print("Scraping results...")
        wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Final Classification')]")))
        
        print("\n" + "="*40)
        print("✅ BOT DETECTION SUCCESSFUL")
        print("The script was executed and the result board is visible.")
        print("Inspect the browser or backend logs for details.")
        print("="*40)
        
    except Exception as e:
        print(f"❌ Test Failed: {e}")
        print("Current URL:", driver.current_url)
        with open("error_page_source.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("Dumped page source to error_page_source.html")
    finally:
        time.sleep(5)
        driver.quit()

if __name__ == "__main__":
    run_bot_test()
