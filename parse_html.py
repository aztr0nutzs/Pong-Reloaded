from html.parser import HTMLParser
import sys

class MyHTMLParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for attr in attrs:
            if attr[0] == 'id' and attr[1] == 'ai-cups':
                print(f"Found ai-cups at line {self.getpos()[0]}")

parser = MyHTMLParser()
with open('app/src/main/assets/index.html', 'r') as f:
    parser.feed(f.read())
