# 자취선배 소개

<img width="1293" height="544" alt="image" src="https://github.com/user-attachments/assets/930a33a9-0dac-4cfb-9f29-78fd61ba10d1" />


자취선배는 여러 플랫폼에서 찾은 매물 후보를 한곳에 모으고,    
방문 전/현장/계약 전 확인 내용을 사진과 메모로 기록해 비교하도록 돕는 임차인용 집 선택 도구입니다.

방을 보러 다니면 사진은 갤러리에, 메모는 메모장에, 나머지는 머릿속에 흩어집니다.    
자취선배에서는 살 동네를 찾고, 방을 보러 가서 체크리스트로 기록하고, 본 방들을 한 화면에서 비교할 수 있습니다.

<p align="center">
  <img width="774" height="436" alt="흩어진 사진·메모(BEFORE)와 자취선배 매물 목록(AFTER) 비교" src="https://github.com/user-attachments/assets/70cb7504-25b2-4e25-8ee0-9e7344c92ed8" />
</p>


🏠 [자취선배 바로가기](https://www.jachwi-sunbae.kr)

## 주요 기능

동네 찾기부터 방 기록, 방 비교까지 집을 고르는 흐름을 한 서비스 안에서 이어갑니다.

<table>
  <tr>
    <td align="center"><img width="280" alt="01 동네 찾기 — 회사까지 걸리는 시간과 환승 횟수로 찾아요" src="https://github.com/user-attachments/assets/795be29f-d80e-435f-86fb-317f1002aa34" /></td>
    <td align="center"><img width="280" alt="02 방 기록 — 매물 정보와 현장 체크리스트를 한곳에 남겨요" src="https://github.com/user-attachments/assets/1920867c-c258-4385-8cbe-874e581cf092" /></td>
    <td align="center"><img width="280" alt="03 방 비교 — 기록한 매물을 한눈에 보고 비교할 방을 골라요" src="https://github.com/user-attachments/assets/885c1946-d134-480a-9ad7-11d45d5dfa7a" /></td>
  </tr>
</table>

<table>
  <tr>
    <td align="center"><img width="400" alt="통근 조건으로 동네 찾기 — 출퇴근 장소와 최대 시간·환승 횟수를 설정해요" src="https://github.com/user-attachments/assets/1668f04d-7447-407c-b5b1-1bacc5c635b0" /></td>
    <td align="center"><img width="370" alt="AI로 매물 정보 자동 입력 — 캡처에서 보증금·월세·관리비 등을 읽어 채워요" src="https://github.com/user-attachments/assets/8a0a3803-138e-4705-8483-f180120d7588" /></td>
  </tr>
</table>

## 가설 검증

가설을 세우고 사용자와 직접 부딪혀 보며, 개선시켜왔습니다.

<img width="1893" height="667" alt="가설 검증 — CYCLE 1 자취 생활 전체에서 방 구하기로, CYCLE 2 체크리스트에 지도 추가, CYCLE 3 볼 방이 정해진 사람에서 방을 찾을 사람으로" src="https://github.com/user-attachments/assets/29ebd718-203b-4e97-aac0-3a86d006a058" />

## 시스템 아키텍처

### Server

<img width="2880" height="2386" alt="자취선배 서버 아키텍처" src="https://github.com/user-attachments/assets/ae32f3cd-0073-4eef-a965-23dcb9695f42" />


### Frontend

<img width="2400" height="1440" alt="자취선배 프론트엔드 아키텍처" src="https://github.com/user-attachments/assets/4cc4023c-0f1e-4180-842a-b5993bce154b" />



## 기술 스택

| 분야 | 기술 |
| --- | --- |
| Backend | Java 21, Spring Boot 3.5, Spring JDBC, Flyway, Caffeine, Springdoc OpenAPI, Thymeleaf·OpenHTMLtoPDF, Firebase Admin |
| Frontend | React 19, TypeScript, Webpack, React Router, TanStack Query, Emotion |
| Mobile | React Native, React Native WebView, Firebase Cloud Messaging, Notifee |
| Database | MySQL(Amazon RDS) |
| Infra | AWS VPC, ALB, EC2·Auto Scaling Group, S3, CloudFront, Bedrock |
| Monitoring | Prometheus, Grafana, Micrometer, Amazon CloudWatch, Amazon SNS, PostHog, Discord |
| CI/CD | GitHub Actions, AWS CodePipeline, AWS CodeDeploy |
| Test·QA | JUnit, Testcontainers, ArchUnit, Vitest, Testing Library, MSW, Storybook, Stryker, Playwright |

## 팀원 소개

<table>
  <tr>
    <td align="center"><a href="https://github.com/softmoca"><img src="https://avatars.githubusercontent.com/u/105472863?v=4" width="120" alt="모카" /></a></td>
    <td align="center"><a href="https://github.com/iftype"><img src="https://avatars.githubusercontent.com/u/107661542?v=4" width="120" alt="콘티" /></a></td>
    <td align="center"><a href="https://github.com/quddaz"><img src="https://avatars.githubusercontent.com/u/127312774?v=4" width="120" alt="쿠다" /></a></td>
    <td align="center"><a href="https://github.com/jeonwonjun"><img src="https://avatars.githubusercontent.com/u/84172525?v=4" width="120" alt="워넬" /></a></td>
  </tr>
  <tr>
    <td align="center"><b>모카</b></td>
    <td align="center"><b>콘티</b></td>
    <td align="center"><b>쿠다</b></td>
    <td align="center"><b>워넬</b></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/softmoca">@softmoca</a></td>
    <td align="center"><a href="https://github.com/iftype">@iftype</a></td>
    <td align="center"><a href="https://github.com/quddaz">@quddaz</a></td>
    <td align="center"><a href="https://github.com/jeonwonjun">@jeonwonjun</a></td>
  </tr>
  <tr>
    <td align="center">Backend · 팀장</td>
    <td align="center">Backend</td>
    <td align="center">Backend</td>
    <td align="center">Frontend</td>
  </tr>
</table>
