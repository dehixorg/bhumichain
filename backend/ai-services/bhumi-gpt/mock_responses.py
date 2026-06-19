"""
Pre-scripted BhumiGPT responses for demo mode.
Keyed by normalised query string (lowercased, stripped).
"""

MOCK_QA: list[dict] = [
    {
        "keywords": ["मुलीचा अधिकार", "daughter", "मुलगी"],
        "language": "mr",
        "response": (
            "होय. **हिंदू वारसा (सुधारणा) अधिनियम 2005** च्या कलम 6(3) नुसार, मुलगी जन्मापासूनच "
            "मिताक्षरा कोपार्सनरी मालमत्तेत सहवारस आहे — मुलाइतकाच तिचा अधिकार आहे.\n\n"
            "सर्वोच्च न्यायालयाने **Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1** मध्ये हे पुष्टी केले.\n\n"
            "BhumiChain वरील **Uttaradhikar chaincode** हे chaincode स्तरावर लागू करते — "
            "कोणताही महसूल अधिकारी मुलीचा वाटा कमी करू शकत नाही."
        ),
        "confidence": 0.98,
        "sources": [
            "Hindu Succession (Amendment) Act 2005, Section 6(3)",
            "Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1",
        ],
    },
    {
        "keywords": ["आदिवासी जमीन", "tribal land", "schedule v", "schedule 5"],
        "language": "mr",
        "response": (
            "**नाही.** पाचव्या अनुसूचीत (Schedule V) समाविष्ट क्षेत्रातील आदिवासी जमीन "
            "गैर-आदिवासींना विकता येत नाही.\n\n"
            "सर्वोच्च न्यायालयाने **Samatha v. State of AP (1997) 8 SCC 191** मध्ये स्पष्ट सांगितले की "
            "असे हस्तांतरण **void ab initio** आहे.\n\n"
            "BhumiChain चे TribalGuard हे <200ms मध्ये स्वयंचलितपणे नाकारते."
        ),
        "confidence": 0.99,
        "sources": [
            "Constitution of India, Fifth Schedule, Article 244(1)",
            "Samatha v. State of Andhra Pradesh (1997) 8 SCC 191",
            "Maharashtra Land Revenue Code, Section 36A",
        ],
    },
    {
        "keywords": ["encumbrance", "ec", "बोजे", "गहाण"],
        "language": "mr",
        "response": (
            "BhumiChain वर **30 सेकंदांत** Encumbrance Certificate (EC) मिळते.\n\n"
            "1. GIS Map वर DLPI नंबर शोधा\n"
            "2. 'Generate EC' बटण दाबा\n"
            "3. QR-verified EC तत्काळ तयार होते\n\n"
            "EC मध्ये सर्व गहाण, न्यायालयीन आदेश, आणि IT attachment नोंदवलेले असतात. "
            "पारंपारिक पद्धतीने हे 7-15 दिवस लागत होते."
        ),
        "confidence": 0.95,
        "sources": [
            "Registration Act 1908, Section 57",
            "BhumiChain Encumbrance chaincode — GenerateEC()",
        ],
    },
    {
        "keywords": ["सातबारा", "satbara", "7/12", "7 12"],
        "language": "mr",
        "response": (
            "**सातबारा उतारा (7/12)** हा महाराष्ट्रातील सर्वात महत्त्वाचा जमीन दस्तऐवज आहे.\n\n"
            "**Part I** (Register 7): सर्वे नंबर, मालक, क्षेत्र, जमीन प्रकार\n"
            "**Part II** (Register 12): बोजे, गहाण, विविध नोंदी\n\n"
            "BhumiChain वर DLPI हे Satbara चे डिजिटल, tamper-proof रूप आहे — "
            "Mahabhulekh e-Satbara registry शी cross-validated."
        ),
        "confidence": 0.97,
        "sources": [
            "Maharashtra Land Revenue Code, Section 149",
            "Mahabhulekh e-Satbara Registry",
        ],
    },
]


def get_mock_response(query: str) -> dict | None:
    q = query.lower()
    for item in MOCK_QA:
        if any(kw.lower() in q for kw in item["keywords"]):
            return item
    return None
