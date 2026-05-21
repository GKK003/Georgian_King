import React from "react";
import { Link } from "react-router-dom";

const RULES = {
  en: {
    title: "Rules",
    subtitle: "King card game guide",
    back: "Back",
    sections: [
      {
        heading: "Deck and Card Order",
        paragraphs: [
          "King is a card game played with a 32-card deck. The deck contains A, K, Q, J, 10, 9, 8, and 7 from each suit. The card order from highest to lowest is A, K, Q, J, 10, 9, 8, 7.",
          "Suits are spades, hearts, diamonds, and clubs. When cards are shown in a player's hand, they are grouped by suit, and inside each suit they are ordered from A down to 7.",
        ],
      },
      {
        heading: "Players and Dealing",
        paragraphs: [
          "The game is played with 3 players. The first deal gives 10 cards to every player. After seeing those 10 cards, the chooser selects the mode.",
          "The chooser can click different modes and think before confirming. The mode is not locked immediately after clicking it. The mode becomes locked only after the chooser confirms the choice.",
          "If the chooser selects Tricks Positive, the chooser must also choose the main suit before confirming. The main suit can be spades, hearts, diamonds, or clubs. After the chooser confirms the mode and main suit, they cannot be changed.",
          "Then the chooser receives 2 extra cards and now has 12 cards. After that, the chooser removes 2 cards from those 12 cards, following the remove rules for the selected mode. When the chooser removes 2 cards, the round starts. A round has 10 tricks.",
        ],
      },
      {
        heading: "Choosing Modes",
        paragraphs: [
          "Each player can choose each mode only once during the game. For example, if Player 1 chooses No Hearts, Player 1 cannot choose No Hearts again, but the other players can still choose No Hearts when it is their turn to choose.",
          "Every round is worth 40 points total. Some modes give negative points, and Tricks Positive gives positive points.",
        ],
      },
      {
        heading: "No Tricks",
        paragraphs: [
          "In No Tricks, the goal is to avoid taking tricks. There are 10 tricks, and each trick is worth -4 points. In No Tricks, the chooser can remove any 2 cards.",
        ],
      },
      {
        heading: "No Hearts",
        paragraphs: [
          "In No Hearts, the goal is to avoid taking hearts. There are 8 hearts in the deck, and each heart is worth -5 points. In No Hearts, the chooser cannot remove hearts. That means A♥, K♥, Q♥, J♥, 10♥, 9♥, 8♥, and 7♥ cannot be removed.",
        ],
      },
      {
        heading: "No Jacks",
        paragraphs: [
          "In No Jacks, the goal is to avoid taking Jacks. There are 4 Jacks in the deck, and each Jack is worth -10 points. In No Jacks, the chooser cannot remove Jacks. That means J♠, J♥, J♦, and J♣ cannot be removed.",
        ],
      },
      {
        heading: "No Queens",
        paragraphs: [
          "In No Queens, the goal is to avoid taking Queens. There are 4 Queens in the deck, and each Queen is worth -10 points. In No Queens, the chooser cannot remove Queens. That means Q♠, Q♥, Q♦, and Q♣ cannot be removed.",
        ],
      },
      {
        heading: "No Last Two",
        paragraphs: [
          "In No Last Two, the goal is to avoid taking the last two tricks of the round. The second-to-last trick is worth -20 points, and the last trick is worth -20 points. Together, the last two tricks are worth -40 points. In No Last Two, the chooser can remove any 2 cards.",
        ],
      },
      {
        heading: "No King of Hearts",
        paragraphs: [
          "In No King of Hearts, the goal is to avoid taking K♥. The King of Hearts is worth -40 points. In No King of Hearts, the chooser cannot remove hearts. Because of that, K♥ also cannot be removed. The cards A♥, K♥, Q♥, J♥, 10♥, 9♥, 8♥, and 7♥ cannot be removed.",
        ],
      },
      {
        heading: "Tricks Positive",
        paragraphs: [
          "In Tricks Positive, the goal is to take as many tricks as possible. This is the only positive mode. There are 10 tricks, and each trick is worth +4 points.",
          "Before the round starts, the chooser must choose a main suit. The main suit can be spades, hearts, diamonds, or clubs. After the chooser confirms the main suit, it is locked and cannot be changed. After the main suit is locked, the chooser receives 2 extra cards and then removes any 2 cards.",
        ],
      },
      {
        heading: "Playing a Trick",
        paragraphs: [
          "During play, the first card of a trick decides the suit that must be followed. If the first player plays spades and you have spades, you must play spades. If you do not have the suit that was led, you can play another suit.",
          "In Tricks Positive only, there is an extra rule: if you do not have the suit that was led, but you have the main suit, you must play the main suit. For example, if the main suit is hearts and the first player plays spades, then a player with spades must play spades. A player with no spades but with hearts must play hearts. A player with no spades and no hearts can play any card.",
        ],
      },
      {
        heading: "Winning Tricks and Game End",
        paragraphs: [
          "The winner of a trick is normally the player who played the highest card of the suit that was led. For example, if the first card is 9♠ and the other spades played are K♠ and 7♠, then K♠ wins the trick.",
          "In Tricks Positive, the main suit acts like the strongest suit. If any main-suit card is played in the trick, the highest main-suit card wins the trick.",
          "The game continues until every player has chosen every mode once. When all rounds are finished, the player with the highest total score wins the game.",
        ],
      },
    ],
  },
  ge: {
    title: "წესები",
    subtitle: "კინგის თამაშის წესები",
    back: "უკან",
    sections: [
      {
        heading: "დასტა და კარტების სიძლიერე",
        paragraphs: [
          "კინგი არის კარტის თამაში, რომელიც ითამაშება 32-კარტიანი დასტით. დასტაში შედის თითოეული ფერის A, K, Q, J, 10, 9, 8 და 7. კარტების სიძლიერე მაღლიდან დაბლა არის A, K, Q, J, 10, 9, 8, 7.",
          "ფერებია ყვავი, გული, აგური და ჯვარი. ",
        ],
      },
      {
        heading: "მოთამაშეები და დარიგება",
        paragraphs: [
          "თამაში ითამაშება 3 მოთამაშით. თავდაპირველად ყველა მოთამაშეს ურიგდება 10 კარტი. ამ 10 კარტის ნახვის შემდეგ ამრჩევი ირჩევს რეჟიმს.",
          "ამრჩევს შეუძლია დააჭიროს სხვადასხვა რეჟიმს და დაფიქრდეს, სანამ საბოლოოდ დაადასტურებს არჩევანს. რეჟიმი არ იკეტება მხოლოდ დაჭერის შემდეგ. რეჟიმი იკეტება მხოლოდ მაშინ, როცა ამრჩევი დაადასტურებს არჩევანს.",
          "თუ ამრჩევი აირჩევს „კარტის აღება“ რეჟიმს, მან ასევე უნდა აირჩიოს კოზირი დადასტურებამდე. კოზირი შეიძლება იყოს ყვავი, გული, აგური ან ჯვარი. რეჟიმისა და კოზირის დადასტურების შემდეგ მათი შეცვლა აღარ შეიძლება.",
          "ამის შემდეგ ამრჩევი იღებს დამატებით 2 კარტს და უკვე აქვს 12 კარტი. შემდეგ ამრჩევი ამ 12 კარტიდან აგდებს 2 კარტს, 2 კარტის ამოღების შემდეგ იწყება რაუნდი. რაუნდში არის 10 აღება.",
        ],
      },
      {
        heading: "რეჟიმების არჩევა",
        paragraphs: [
          "თითოეულ მოთამაშეს თითოეული რეჟიმის არჩევა შეუძლია მხოლოდ ერთხელ მთელი თამაშის განმავლობაში. მაგალითად, თუ პირველმა მოთამაშემ აირჩია „არ აიღო გულები“, ის ამ რეჟიმს მეორედ ვეღარ აირჩევს, მაგრამ სხვა მოთამაშეებს ისევ შეუძლიათ ამ რეჟიმის არჩევა, როცა მათი არჩევის დრო მოვა.",
          "თითოეული რაუნდი ყოველთვის არის 40 ქულა. ზოგი რეჟიმი იძლევა მინუს ქულებს, ხოლო „კარტის აღება“ იძლევა პლიუს ქულებს.",
        ],
      },
      {
        heading: "არ აიღო კარტები",
        paragraphs: [
          "„არ აიღო კარტები“ რეჟიმში მიზანია არ აიღო კარტები. რაუნდში არის 10 აღება და თითოეული აღება არის -4 ქულა. ამ რეჟიმში ამრჩევს შეუძლია ნებისმიერი 2 კარტის ამოღება.",
        ],
      },
      {
        heading: "არ აიღო გულები",
        paragraphs: [
          "„არ აიღო გულები“ რეჟიმში მიზანია არ აიღო გულის კარტები. დასტაში არის 8 გული და თითოეული გული არის -5 ქულა. ამ რეჟიმში ამრჩევს არ შეუძლია გულის კარტების ამოღება. ანუ A♥, K♥, Q♥, J♥, 10♥, 9♥, 8♥ და 7♥ ვერ იქნება ამოღებული.",
        ],
      },
      {
        heading: "არ აიღო ვალეტები",
        paragraphs: [
          "„არ აიღო ვალეტები“ რეჟიმში მიზანია არ აიღო ვალეტები. დასტაში არის 4 ვალეტი და თითოეული ვალეტი არის -10 ქულა. ამ რეჟიმში ამრჩევს არ შეუძლია ვალეტების ამოღება. ანუ J♠, J♥, J♦ და J♣ ვერ იქნება ამოღებული.",
        ],
      },
      {
        heading: "არ აიღო დამები",
        paragraphs: [
          "„არ აიღო დამები“ რეჟიმში მიზანია არ აიღო დამები. დასტაში არის 4 დამა და თითოეული დამა არის -10 ქულა. ამ რეჟიმში ამრჩევს არ შეუძლია დამების ამოღება. ანუ Q♠, Q♥, Q♦ და Q♣ ვერ იქნება ამოღებული.",
        ],
      },
      {
        heading: "არ აიღო ბოლო ორი",
        paragraphs: [
          "„არ აიღო ბოლო ორი“ რეჟიმში მიზანია არ აიღო რაუნდის ბოლო ორი კარტი. თითო აღება არის -20 ქულა, ერთად ბოლო ორი აღება არის -40 ქულა. ამ რეჟიმში ამრჩევს შეუძლია ნებისმიერი 2 კარტის ამოღება.",
        ],
      },
      {
        heading: "არ აიღო გულის კინგი(კაროლი)",
        paragraphs: [
          "„არ აიღო გულის კინგი“ რეჟიმში მიზანია არ აიღო K♥. გულის მეფე არის -40 ქულა. ამ რეჟიმში ამრჩევს არ შეუძლია გულის კარტების ამოღება. A♥, K♥, Q♥, J♥, 10♥, 9♥, 8♥ და 7♥ ვერ იქნება ამოღებული.",
        ],
      },
      {
        heading: "კარტის აღება",
        paragraphs: [
          "„კარტის აღება“ რეჟიმში მიზანია რაც შეიძლება მეტი კარტის აღება. ეს არის ერთადერთი პლიუს რეჟიმი. რაუნდში არის 10 აღება და თითოეული აღება არის +4 ქულა.",
          "რაუნდის დაწყებამდე ამრჩევმა უნდა აირჩიოს კოზირი. კოზირი შეიძლება იყოს ყვავი, გული, აგური ან ჯვარი. კოზირის დადასტურების შემდეგ ის იკეტება და მისი შეცვლა აღარ შეიძლება. კოზირის დაბლოკვის შემდეგ ამრჩევი იღებს დამატებით 2 კარტს და შემდეგ აგდებს ნებისმიერ 2 კარტს.",
        ],
      },
      {
        heading: "კარტის ჩამოსვლა",
        paragraphs: [
          "თამაშის დროს,  პირველი კარტი განსაზღვრავს ფერს, რომელსაც მოთამაშეებმა უნდა მიჰყვნენ. თუ პირველმა მოთამაშემ ჩავიდა ყვავი და შენ გაქვს ყვავი, აუცილებლად უნდა ჩახვიდე ყვავი. თუ არ გაქვს ის ფერი, რომელიც პირველმა მოთამაშემ ჩავიდა, შეგიძლია სხვა ფერი ჩახვიდე.",
          "მხოლოდ „კარტის აღება“ რეჟიმში მოქმედებს დამატებითი წესი: თუ არ გაქვს ის ფერი, რომელიც პირველმა მოთამაშემ ჩავიდა, მაგრამ გაქვს კოზირი, აუცილებლად უნდა ჩახვიდე კოზირი. მაგალითად, თუ კოზირია გული და პირველმა მოთამაშემ ჩავიდა ყვავი, მაშინ მოთამაშე, რომელსაც აქვს ყვავი, ვალდებულია ჩავიდეს ყვავი. ამ შემთხვევაში მოთამაშე, რომელსაც არც ყვავი აქვს და არც გული, შეუძლია ჩავიდეს ნებისმიერი კარტი.",
        ],
      },
      {
        heading: "რიგების მოგება და თამაშის დასრულება",
        paragraphs: [
          "ჩვეულებრივ, რიგებას იგებს ის მოთამაშე, რომელმაც ჩასული ფერიდან ყველაზე მაღალი კარტი ჩავიდა. მაგალითად, თუ პირველი კარტი არის 9♠ და სხვა ჩასული ყვავებია K♠ და 7♠, მაშინ K♠ იგებს აღებას.",
          "„კარტის აღება“ რეჟიმში კოზირი ყველაზე ძლიერ ფერად ითვლება. თუ აღებაში კოზირის რომელიმე კარტი ჩავიდა, მაშინ აღებას იგებს კოზირის ყველაზე მაღალი კარტი.",
          "თამაში გრძელდება მანამ, სანამ ყველა მოთამაშე ყველა რეჟიმს ერთხელ არ აირჩევს. როცა ყველა რაუნდი დასრულდება, თამაშს იგებს ის მოთამაშე, ვისაც ყველაზე მაღალი ჯამური ქულა აქვს.",
        ],
      },
    ],
  },
};

export default function RulesPage({ backTo = "/room", lang = "en" }) {
  const rules = RULES[lang] || RULES.en;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-slate-900 p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
              King Online
            </p>
            <h1 className="mt-2 text-4xl font-black">{rules.title}</h1>
            <p className="mt-2 text-sm font-bold text-slate-400">
              {rules.subtitle}
            </p>
          </div>

          <Link
            to={backTo}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-100 hover:bg-white/10"
          >
            {rules.back}
          </Link>
        </div>

        <div className="space-y-5">
          {rules.sections.map((section) => (
            <section
              key={section.heading}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
            >
              <h2 className="text-xl font-black text-amber-200">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
