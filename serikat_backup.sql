-- MySQL dump 10.13  Distrib 9.3.0, for macos13.7 (x86_64)
--
-- Host: localhost    Database: serikat_db
-- ------------------------------------------------------
-- Server version	9.3.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `gallery`
--

DROP TABLE IF EXISTS `gallery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gallery` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `slug` varchar(255) DEFAULT NULL,
  `image` varchar(255) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gallery`
--

LOCK TABLES `gallery` WRITE;
/*!40000 ALTER TABLE `gallery` DISABLE KEYS */;
INSERT INTO `gallery` VALUES (2,'Bersama Direksi','bersama-direksi-1767246220476','/uploads/gallery/1767246220469-987696998.png','Silaturahmi bersama direksi dan komisaris',1,0,'2026-01-01 05:43:40','2026-01-01 05:43:40');
/*!40000 ALTER TABLE `gallery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hero_slides`
--

DROP TABLE IF EXISTS `hero_slides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hero_slides` (
  `id` int NOT NULL AUTO_INCREMENT,
  `image` varchar(255) NOT NULL,
  `title` varchar(200) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hero_slides`
--

LOCK TABLES `hero_slides` WRITE;
/*!40000 ALTER TABLE `hero_slides` DISABLE KEYS */;
INSERT INTO `hero_slides` VALUES (3,'/uploads/gallery/1767088562977-31661213.png','kongres',1,2,'2025-12-30 09:56:03'),(4,'/uploads/gallery/1767088612268-237764255.png','direksi 1',1,1,'2025-12-30 09:56:52'),(5,'/uploads/gallery/1767088978351-145568084.png','direksi2',1,0,'2025-12-30 10:02:58');
/*!40000 ALTER TABLE `hero_slides` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_cards`
--

DROP TABLE IF EXISTS `member_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `card_number` varchar(20) NOT NULL,
  `card_image` varchar(255) DEFAULT NULL,
  `card_image_back` varchar(255) DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `member_cards_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_cards`
--

LOCK TABLES `member_cards` WRITE;
/*!40000 ALTER TABLE `member_cards` DISABLE KEYS */;
INSERT INTO `member_cards` VALUES (1,3,'MBR00002','/uploads/cards/card-MBR00002-1767076623418.html',NULL,'2025-12-30','2026-12-30','2025-12-30 06:37:03'),(2,3,'MBR00002','/uploads/cards/card-MBR00002-1767160982039.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:03:02'),(3,3,'MBR00002','/uploads/cards/card-MBR00002-1767161741975.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:15:42'),(4,3,'MBR00002','/uploads/cards/card-MBR00002-1767162468445.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:27:48'),(5,3,'MBR00002','/uploads/cards/card-MBR00002-1767162942793.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:35:43'),(6,3,'MBR00002','/uploads/cards/card-MBR00002-1767163083355.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:38:03'),(7,3,'MBR00002','/uploads/cards/card-MBR00002-1767163103588.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:38:23'),(8,3,'MBR00002','/uploads/cards/card-MBR00002-1767163381581.png',NULL,'2025-12-31','2026-12-31','2025-12-31 06:43:02'),(9,3,'MBR00002','/uploads/cards/card-MBR00002-1767165263608.png',NULL,'2025-12-31','2026-12-31','2025-12-31 07:14:24'),(10,3,'MBR00002','/uploads/cards/card-MBR00002-1767165702822.png',NULL,'2025-12-31','2026-12-31','2025-12-31 07:21:43'),(11,3,'MBR00002','/uploads/cards/card-MBR00002-1767166048660.png',NULL,'2025-12-31','2026-12-31','2025-12-31 07:27:28'),(12,3,'MBR00002','/uploads/cards/card-MBR00002-1767166336042.png',NULL,'2025-12-31','2026-12-31','2025-12-31 07:32:16'),(13,3,'MBR00002','/uploads/cards/card-MBR00002-1767168992245.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:16:32'),(14,3,'MBR00002','/uploads/cards/card-MBR00002-1767169978125.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:32:58'),(15,3,'MBR00002','/uploads/cards/card-MBR00002-1767169978484.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:32:58'),(16,3,'MBR00002','/uploads/cards/card-MBR00002-1767170116752.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:35:17'),(17,3,'MBR00002','/uploads/cards/card-MBR00002-1767170389780.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:39:49'),(18,3,'MBR00002','/uploads/cards/card-MBR00002-1767170467673.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:41:07'),(19,3,'MBR00002','/uploads/cards/card-MBR00002-1767171100125.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:51:40'),(20,3,'MBR00002','/uploads/cards/card-MBR00002-1767171171126.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:52:51'),(21,3,'MBR00002','/uploads/cards/card-MBR00002-1767171182485.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:53:02'),(22,3,'MBR00002','/uploads/cards/card-MBR00002-1767171376864.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:56:17'),(23,3,'MBR00002','/uploads/cards/card-MBR00002-1767171476268.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:57:56'),(24,3,'MBR00002','/uploads/cards/card-MBR00002-1767171596987.png',NULL,'2025-12-31','2026-12-31','2025-12-31 08:59:57'),(25,3,'MBR00002','/uploads/cards/card-MBR00002-1767171662324.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:01:02'),(26,3,'MBR00002','/uploads/cards/card-MBR00002-1767171703931.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:01:44'),(27,3,'MBR00002','/uploads/cards/card-MBR00002-1767171936802.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:05:36'),(28,3,'MBR00002','/uploads/cards/card-MBR00002-1767172179403.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:09:39'),(29,3,'MBR00002','/uploads/cards/card-MBR00002-1767172357979.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:12:38'),(30,3,'MBR00002','/uploads/cards/card-MBR00002-1767172360493.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:12:40'),(31,3,'MBR00002','/uploads/cards/card-MBR00002-1767172377528.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:12:57'),(32,3,'MBR00002','/uploads/cards/card-MBR00002-1767172393612.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:13:13'),(33,3,'MBR00002','/uploads/cards/card-MBR00002-1767172405926.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:13:26'),(34,3,'MBR00002','/uploads/cards/card-MBR00002-1767172407458.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:13:27'),(35,3,'MBR00002','/uploads/cards/card-MBR00002-1767172408711.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:13:28'),(36,3,'MBR00002','/uploads/cards/card-MBR00002-1767172420447.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:13:40'),(37,3,'MBR00002','/uploads/cards/card-MBR00002-1767172833153.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:20:33'),(38,3,'MBR00002','/uploads/cards/card-MBR00002-1767172861827.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:21:01'),(39,3,'MBR00002','/uploads/cards/card-MBR00002-1767172937929.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:22:18'),(40,3,'MBR00002','/uploads/cards/card-MBR00002-1767173123233.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:25:23'),(41,3,'MBR00002','/uploads/cards/card-MBR00002-1767173157150.png',NULL,'2025-12-31','2026-12-31','2025-12-31 09:25:57'),(42,3,'MBR00002','/uploads/cards/card-MBR00002-1767176201058.png',NULL,'2025-12-31','2026-12-31','2025-12-31 10:16:41'),(43,3,'MBR00002','/uploads/cards/card-MBR00002-1767252108574.png',NULL,'2026-01-01','2027-01-01','2026-01-01 07:21:48'),(44,3,'MBR00002','/uploads/cards/card-MBR00002-1767252154204.png',NULL,'2026-01-01','2027-01-01','2026-01-01 07:22:34'),(45,3,'MBR00002','/uploads/cards/card-MBR00002-1767252208628.png',NULL,'2026-01-01','2027-01-01','2026-01-01 07:23:28'),(46,3,'MBR00002','/uploads/cards/card-MBR00002-1767252322657.png',NULL,'2026-01-01','2027-01-01','2026-01-01 07:25:22'),(47,3,'MBR00002','/uploads/cards/card-MBR00002-1767252497245.png',NULL,'2026-01-01','2027-01-01','2026-01-01 07:28:17'),(48,3,'MBR00002','/uploads/cards/card-MBR00002-1767252555386.png',NULL,'2026-01-01','2027-01-01','2026-01-01 07:29:15'),(49,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767253774277.png','/uploads/cards/card-MBR00002-back-1767253774277.png','2026-01-01','2027-01-01','2026-01-01 07:49:34'),(50,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767254413633.png','/uploads/cards/card-MBR00002-back-1767254413633.png','2026-01-01','2027-01-01','2026-01-01 08:00:13'),(51,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767254998696.png','/uploads/cards/card-MBR00002-back-1767254998696.png','2026-01-01','2027-01-01','2026-01-01 08:09:59'),(52,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767257081393.png','/uploads/cards/card-MBR00002-back-1767257081393.png','2026-01-01','2027-01-01','2026-01-01 08:44:41'),(53,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767257366986.png','/uploads/cards/card-MBR00002-back-1767257366986.png','2026-01-01','2027-01-01','2026-01-01 08:49:27'),(54,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767257391198.png','/uploads/cards/card-MBR00002-back-1767257391198.png','2026-01-01','2027-01-01','2026-01-01 08:49:51'),(55,3,'MBR00002','/uploads/cards/card-MBR00002-front-1767257936371.png','/uploads/cards/card-MBR00002-back-1767257936371.png','2026-01-01','2027-01-01','2026-01-01 08:58:56');
/*!40000 ALTER TABLE `member_cards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `is_published` tinyint(1) DEFAULT '0',
  `views` int DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `news_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
INSERT INTO `news` VALUES (1,'Contoh Berita SP KAI','contoh-berita-sp-kai-1767248320130','Ini Contoh Berita Yang ditulis oleh admin ','/uploads/news/1767248320106-867513727.png',1,3,1,'2026-01-01 06:18:40','2026-01-01 10:24:12');
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `site_settings`
--

DROP TABLE IF EXISTS `site_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text,
  `setting_type` enum('text','textarea','image') DEFAULT 'text',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `site_settings`
--

LOCK TABLES `site_settings` WRITE;
/*!40000 ALTER TABLE `site_settings` DISABLE KEYS */;
INSERT INTO `site_settings` VALUES (1,'site_name','Serikat Pekerja Kereta Api Indonesia (SP-KAI)','text','2025-12-30 06:27:28','2025-12-30 10:25:32'),(2,'site_tagline','Bangkit Bersatu Maju','text','2025-12-30 06:27:28','2026-01-01 09:23:50'),(3,'hero_title','Serikat Pekerja SP-KAI','text','2025-12-30 06:27:28','2025-12-30 10:03:47'),(4,'hero_subtitle','SP-KAI adalah salah satu serikat pekerja dalam PT Kereta Api Indonesia. SP-KAI bertujuan untuk memperjuangkan hak-hak pekerja PT KAI, mengawal hak-hak kesejahteraan pekerja, dan memastikan tata kelola perusahaan serta membawa perubahan untuk KAI lebih baik.','textarea','2025-12-30 06:27:28','2025-12-31 10:38:22'),(5,'hero_image','/images/hero-bg.jpg','image','2025-12-30 06:27:28','2025-12-30 06:27:28'),(6,'about_title','Tentang Kami','text','2025-12-30 06:27:28','2025-12-30 06:27:28'),(7,'about_content','SP-KAI adalah salah satu serikat pekerja dalam PT Kereta Api Indonesia. SP-KAI bertujuan untuk memperjuangkan hak-hak pekerja PT KAI, mengawal hak-hak kesejahteraan pekerja, dan memastikan tata kelola perusahaan serta membawa perubahan untuk KAI lebih baik.','textarea','2025-12-30 06:27:28','2026-01-01 09:24:02'),(8,'about_image','/uploads/about/1767241031455-248570516.png','image','2025-12-30 06:27:28','2026-01-01 04:17:11'),(9,'footer_address','Jl. Contoh No. 123, Jakarta','text','2025-12-30 06:27:28','2025-12-30 06:27:28'),(10,'footer_phone','021-12345678','text','2025-12-30 06:27:28','2025-12-30 06:27:28'),(11,'footer_email','sp-kai@gmail.com','text','2025-12-30 06:27:28','2026-01-01 09:00:49'),(12,'footer_copyright','© 2026 Serikat. All rights reserved.','text','2025-12-30 06:27:28','2026-01-01 09:00:49'),(25,'logo_image','/uploads/gallery/1767241407387-12109993.png','image','2025-12-30 08:51:50','2026-01-01 04:23:27'),(26,'logo_width','120','text','2025-12-30 08:51:50','2026-01-01 04:23:46'),(27,'logo_height','60','text','2025-12-30 08:51:50','2025-12-30 09:39:42'),(28,'vision','Menjadi serikat pekerja yang profesional, kompeten dan terpercaya dalam membangun hubungan industrial guna mewujudkan kesejahteraan pekerja yang adil, proporsional dan bertanggung jawab.\r\n','textarea','2025-12-31 11:08:19','2026-01-01 04:25:09'),(29,'mission','<ul><li>1. Memperjuangkan persamaan hak dan kewajiban sesama pekerja.</li><br/>\r\n<li>2. Menjembatani kepentingan dan aspirasi pekerja dengan perusahaan.</li><br/>\r\n<li>3. Menciptakan suasana kerja yang kondusif dan menumbuhkan rasa solidaritas antar pekerja.</li><br/>\r\n<li>4. Menjadikan serikat pekerja yang transparan, amanah dan profesional.</li><br/>\r\n<li>5. Mensukseskan program-program perusahaan dan organisasi.</li></ul>\r\n','textarea','2025-12-31 11:08:19','2026-01-01 09:23:45'),(30,'feature_1_title','Perjuangan Hak Pekerja','text','2025-12-31 11:08:19','2025-12-31 11:08:19'),(31,'feature_1_description','Kami berjuang untuk melindungi hak-hak pekerja dan memastikan keadilan di tempat kerja','textarea','2025-12-31 11:08:19','2025-12-31 11:08:19'),(32,'feature_2_title','Perlindungan Hukum','text','2025-12-31 11:08:19','2025-12-31 11:08:19'),(33,'feature_2_description','Memberikan dukungan dan konsultasi hukum untuk anggota yang membutuhkan bantuan','textarea','2025-12-31 11:08:19','2025-12-31 11:08:19'),(34,'feature_3_title','Solidaritas Berserikat','text','2025-12-31 11:08:19','2025-12-31 11:08:19'),(35,'feature_3_description','Membangun komunitas yang solid dan saling mendukung untuk kesuksesan bersama','textarea','2025-12-31 11:08:19','2025-12-31 11:08:19');
/*!40000 ALTER TABLE `site_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone` varchar(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text,
  `photo` varchar(255) DEFAULT NULL,
  `role` enum('member','admin') DEFAULT 'member',
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `member_id` varchar(20) DEFAULT NULL,
  `nias` varchar(50) DEFAULT NULL,
  `card_generated_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  UNIQUE KEY `member_id` (`member_id`),
  UNIQUE KEY `nias` (`nias`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'081234567890','$2b$10$qMmxCQ8R6oYLkzwVhTIA3.asfc4hm5fT45gfwm/nohSnN5wnA0/TS','Administrator','admin@serikat.id',NULL,NULL,'admin','approved','ADM001',NULL,NULL,'2025-12-30 06:27:28','2025-12-30 06:36:29'),(3,'081111111111','$2b$10$Q9/4e524oTiF9VBhgBl9z.gb7reC5b5Hwi433.bK7Zyj.laR.fsu.','Agus Dwi Budi Santoso','test@test.com','Jalan contoh no 55','/uploads/members/1767254995760-423084446.png','member','approved','MBR00002','464020005202300001','2026-01-01 15:58:56','2025-12-30 06:36:49','2026-01-01 08:58:56');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-01 18:00:14
