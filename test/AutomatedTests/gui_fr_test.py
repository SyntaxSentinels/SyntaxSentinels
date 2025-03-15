import os
from time import sleep
import random
import string

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC



APP_URL = "https://syntax-sentinels.vercel.app"


def get_files_to_upload(directory):
    file_directory = os.path.abspath(os.path.join(os.path.dirname(__file__), directory))
    return [os.path.join(file_directory, f) for f in os.listdir(file_directory) if f.endswith(".py")]


def run_tests_flow2(url):
    driver = webdriver.Chrome()
    driver.get(url)
    try:
        # FR-6: create account fail
        login_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Log In']"))
        )
        login_button.click()

        sign_up_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[text()='Sign up']"))
        )
        sign_up_button.click()

        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "email"))
        )

        email_field = driver.find_element(By.ID, "email")
        password_field = driver.find_element(By.ID, "password")
        
        email_field.send_keys("doverb410@gmail.com")
        password_field.send_keys("aaaaaA1!")

        continue_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Continue']"))
        )
        continue_button.click()

        failure_message = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//p[text()='Something went wrong, please try again later']"))
        )
        assert "Something went wrong, please try again later" in failure_message.text, "Account creation should have failed"

        # FR-7: create account success
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "email"))
        )

        email_field = driver.find_element(By.ID, "email")
        password_field = driver.find_element(By.ID, "password")
        
        email_prefix = ''.join(random.choice(string.ascii_letters) for _ in range(20))
        email_field.clear()
        email_field.send_keys("test_"+email_prefix+"@gmail.com")
        password_field.send_keys("aaaaaA1!")

        continue_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Continue']"))
        )
        continue_button.click()

        accept_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Accept']"))
        )
        accept_button.click()

        sleep(3)

    except Exception as e:
        print(f"Error: {e}")

    driver.quit()


def run_tests_flow1(url):
    driver = webdriver.Chrome()
    driver.get(url)
    try:
        login_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Log In']"))
        )
        login_button.click()

        # FR-8: log in fail
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "username"))
        )
        
        email_field = driver.find_element(By.ID, "username")
        password_field = driver.find_element(By.ID, "password")
        
        email_field.send_keys("doverb410@gmail.com")
        password_field.send_keys("wrong password")
        
        continue_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Continue']"))
        )
        continue_button.click()

        error_message = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "error-element-password"))
        )
        assert "Wrong email or password" in error_message.text, "Error message not found"

        # FR-7: log in success
        # FIXME: Plaintext password! Although I do not care about this account!
        password_field = driver.find_element(By.ID, "password")
        password_field.send_keys("nqxXbq3eg7VKMTb!")
        
        continue_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Continue']"))
        )
        continue_button.click()

        # FR-2: multiple upload
        for i in range(1, 4):
            # FR-1: input files
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "analysisName"))
            )
            
            file_input = driver.find_element(By.XPATH, "//input[@type='file']")
            python_files = get_files_to_upload("../TwoSum")
            
            assert python_files
            file_input.send_keys("\n".join(python_files))
            
            # FR-4: analyze dataset
            analysis_name_field = driver.find_element(By.ID, "analysisName")
            analysis_name_field.send_keys(f"autoTest{i}")
            
            analyze_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//span[text()='Analyze Dataset']"))
            )
            analyze_button.click()

            success_message = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'ant-message-notice-success')]"))
            )
            sleep(0.1)
            assert "Analysis started successfully" in success_message.text, "Success message not found"
            WebDriverWait(driver, 10).until(
                EC.invisibility_of_element((By.XPATH, "//div[contains(@class, 'ant-message-notice-success')]"))
            )
            # FR-9: check that email got zip files
            # This has to be done manually for now...
        
        # FR-10: upload zip and check for results
        upload_results_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//li[span[text()='Upload Results']]"))
        )
        upload_results_button.click()

        zip_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "numIslandsDemo.zip"))
        zip_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@type='file']"))
        )
        zip_input.send_keys(zip_file_path)

        view_results_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//span[text()='View Results']"))
        )
        view_results_button.click()
        visualization = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//h1[text()='Source Code Plagiarism Detection Report']"))
        )
        assert "Source Code Plagiarism Detection Report" in visualization.text, "Report header not found"

        sleep(2)

    except Exception as e:
        print(f"Error: {e}")

    driver.quit()


if __name__ == "__main__":
    target_url = APP_URL
    run_tests_flow1(target_url)
    run_tests_flow2(target_url)
    print("Done testing!")
